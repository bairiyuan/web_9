# 项目结构与运行流程

```text
backend/
  pom.xml                         Maven依赖与打包配置
  src/main/java/com/quiz/App.java  Spring Boot入口、接口、权限、数据库操作
  src/main/resources/
    application.properties        端口、数据库连接池、环境变量
    schema.sql                    users与questions建表语句
frontend/
  index.html                      用户端页面
  app.js                          注册登录、加载题目、提交及显示结果
  style.css                       两个前端共用样式
  admin/
    index.html                    管理端入口
    src.js                        Vue界面与管理操作
    package.json                  Vue/Vite依赖、构建命令
    package-lock.json             依赖锁定
 deploy/                          部署脚本、Nginx/systemd配置、接口验收脚本
 docs/                            验收步骤、服务器改动与项目说明
```

## 请求流向
浏览器访问Nginx：`/quiz/`返回原生页面，`/quiz/admin/`返回Vue构建产物；`/quiz/api/`代理到127.0.0.1:8081/api/，Spring Boot使用JdbcTemplate访问独立MySQL库quiz。页面与接口同源，Java无需配置跨域。

## 后端组织
当前是小型课程项目，接口集中在App.java，未拆分Controller/Service/Repository：main启动服务；seed初始化管理员和示例题；user解析JWT并查询数据库核对token_version与角色；insertUser和question负责公共校验；各接口通过参数化SQL读写数据。

- `/register`：注册普通用户。
- `/login`：校验BCrypt密码，签发两小时JWT；admin=true要求管理员角色。
- `/questions`：返回最多50题，不返回答案。
- `/submit`：校验提交答案，查询正确答案，计算分数与逐题结果。
- `/admin/users`：分页搜索和新增用户；DELETE删除；reset仅重置普通用户密码。
- `/admin/questions`：分页搜索、新增、修改、删除题目。

## 数据与权限
users保存id、username、password哈希、role、token_version；questions保存题干、四个选项和正确答案0至3。JWT存在浏览器sessionStorage，每次请求通过Authorization头发送。管理员权限由后端再次检查，密码重置递增token_version使旧JWT失效。

用户端使用原生DOM操作；管理端使用Vue响应式状态维护当前列表、搜索词、页码和编辑表单，Vite构建成静态文件。成绩即时展示，没有历史成绩表。

## 部署与限制
本地构建JAR和Vue，服务器复用Nginx/MySQL，systemd以专用quiz用户启动项目内JRE。具体路径、资源上限、变更和回滚见server-changes.md。该实现适合课程验收，未做高并发容量测试，当前服务器内存紧张。管理员演示账号为admin / 123456。
