# 服务器改动记录

## 部署范围（2026-11-15）
目标：阿里云 `116.62.149.236`，SSH别名 `aliyun-dev`。现有新航路系统运行在同机，健康接口 `/xinhanglu/api/health`。

原则：本地构建，复用现有Nginx/MySQL，使用独立目录、账号和端口；不修改现有站点文件、排课数据、MySQL全局参数、防火墙、系统默认Java和Swap。

## 新增内容
| 位置/资源 | 用途 |
|---|---|
| `/opt/quiz/runtime/` | 项目专用 Temurin JRE 21.0.13+9，官方发行包SHA256校验 |
| `/opt/quiz/quiz.jar` | Spring Boot后端 |
| `/opt/quiz/backups/` | 后续更新的旧JAR备份 |
| `/var/www/quiz/` | 原生用户端与Vue管理端静态产物 |
| `/etc/quiz/quiz.env` | root专读0600，数据库密码、JWT密钥、初始管理员密码 |
| 系统用户/组 `quiz` | 无登录权限的后端专用身份 |
| MySQL库 `quiz` | users、questions两张表 |
| MySQL账号 `quiz_app@127.0.0.1` | 仅quiz库SELECT/INSERT/UPDATE/DELETE/CREATE权限 |
| `/etc/systemd/system/quiz.service` | 开机启动、异常重启、只读系统、私有临时目录 |
| `/etc/nginx/site-routes/quiz.conf` | `/quiz/`页面和`/quiz/api/`反向代理；复用已有include |
| `/etc/nginx/conf.d/quiz-rate-limit.conf` | Quiz接口每IP每秒10次、突发30次，独立1MB限流区 |

运行参数：仅监听127.0.0.1:8081；堆32–160MB，元空间上限128MB，代码缓存32MB，SerialGC；systemd MemoryHigh=300MB、MemoryMax=380MB、TasksMax=80；MySQL连接池最多3连接；Tomcat最多20线程。内存上限可能使Quiz在资源不足时重启，需观察实际运行情况。

Nginx只在`nginx -t`通过后平滑reload。没有重启现有排课后端或MySQL。

## 回滚
1. `sudo systemctl disable --now quiz`。
2. 移走新增的 `/etc/nginx/site-routes/quiz.conf` 和 `/etc/nginx/conf.d/quiz-rate-limit.conf`，执行 `sudo nginx -t && sudo systemctl reload nginx`。
3. 保留Quiz数据库和目录供恢复；若确定永久移除，先备份再删除Quiz专用文件、数据库、账号及系统用户，不操作其他项目。
4. 升级回滚可恢复 `/opt/quiz/backups/` 的旧JAR再重启Quiz；首次部署没有旧JAR。

## 验证结果
已部署并验证：
- Maven后端打包、Vite管理端构建通过。
- HTTP接口验收覆盖注册、重复注册、JWT、普通用户禁止管理端登录/访问、管理员创建、用户搜索、密码重置及旧JWT撤销、题目增删改查、两页分页、服务端正确/错误计分、非法答案拒绝。
- Playwright Chromium走通管理端登录、题库分页，用户注册、登录、12题作答和报告；浏览器脚本错误为0。检查1280px桌面与390px移动端布局。
- 自动化测试创建的临时用户和题目已清理；保留初始化管理员及12道题。
- 最新检查Quiz cgroup内存184119296字节（约176MiB），NRestarts=0，系统available约288MB，无Swap。数据是单次检查，不代表高并发容量测试。
- Nginx语法检查通过；现有排课系统健康接口持续返回success=true、database=connected。
- 没有安装系统软件包、修改已有站点配置、重启MySQL/排课服务或增加Swap。
- 上传暂存文件位于`/tmp/quiz-*`；后续清理只针对本项目暂存文件。

管理员用户名为`admin`。读取初始密码：由具备sudo权限的维护者在服务器执行`sudo cat /etc/quiz/quiz.env`，查看ADMIN_PASSWORD。该文件还包含服务密钥，勿截图或提交到Git。


## 2026-11-20 更新与故障排查
- 管理员admin密码按要求改为123456，仍以BCrypt哈希存储；token_version递增，旧管理员JWT失效。
- 同步更新root专读的`/etc/quiz/quiz.env`中ADMIN_PASSWORD，未修改JWT密钥或数据库密码。
- 静态页面去掉宣传标语，精简布局；更新前备份至`/opt/quiz/backups/frontend-20261120.tar.gz`。未重启Java、MySQL、Nginx。
- 浏览器验证admin/123456登录、题库列表和390px用户端布局，脚本错误为0。
- `/var/log/kern.log`确认北京时间2026-11-19 17:12:16发生global OOM，内核杀掉mysqld，anon-rss约416MiB；轮转日志还记录2026-11-06 13:56:30同类OOM（发生于Quiz部署前）。因此确认存在整机内存耗尽问题，不能仅凭此证明整段SSH失联原因，也不能把问题全部归因Quiz。
- 重启后MySQL执行crash recovery并恢复连接；仍无Swap。此次仅排查，没有调整系统内存配置。
`n- 同日管理端补充当前账号标记和删除按钮禁用，刷新后仍生效；直接DELETE当前账号接口验证返回400，账号保留。仅更新Vue静态产物。

## 2026-11-20 验收后下线

停止并移除 quiz.service 和开机启动项，删除 Quiz 专用系统账号、JRE、JAR、静态页面、配置、发布备份和暂存包。导出 Quiz 数据库到维护者本机后，删除服务器上的 quiz 库和 quiz_app@127.0.0.1 账号。移除 Quiz 的 Nginx 路由和限流配置，经 nginx -t 检查后平滑重载。验证服务单元已移除、8081 端口已释放，Nginx 和 MySQL 正常运行，排课系统健康接口报告数据库已连接。
