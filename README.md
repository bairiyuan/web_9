# 知测 Quiz

课程作业：原生 HTML/CSS/JS 答题端 + Vue 管理端 + Java Spring Boot + MySQL + Nginx。

## 地址
- 用户端：https://yuanhajimi.xyz/quiz/
- 管理端：https://yuanhajimi.xyz/quiz/admin/

## 本地构建
需要 JDK 21、Maven 3.9、Node.js。

```sh
mvn -f backend/pom.xml package
cd frontend/admin
npm ci
npm run build
```

后端环境变量：`DB_URL`、`DB_USER`、`DB_PASSWORD`、`JWT_SECRET`（至少32字节随机密钥的Base64）、`ADMIN_PASSWORD`。默认绑定 `127.0.0.1:8081`。首次启动自动建表，初始化管理员 `admin` 和12道示例题；管理员密码由环境变量提供。

## 功能
普通用户注册、JWT登录、选择题练习、服务端计分与逐题反馈。管理端仅管理员可登录，支持用户创建/删除/角色选择、普通用户密码重置为123456、题目增删改、关键词查询和每页10条分页。密码采用 BCrypt；JWT有效期2小时，重置密码立即撤销旧令牌。

## 部署
参见 docs/server-changes.md。前端构建与后端编译均在本地进行。生产凭据不进入Git。`deploy/install.py` 仅供已上传并核验产物后以root执行；首次部署与更新操作前应备份已有Quiz数据和产物。数据库迁移不可依赖覆盖文件回滚。
