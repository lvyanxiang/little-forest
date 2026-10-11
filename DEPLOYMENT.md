# Docker 部署与 1Panel

本仓库包含三个独立项目：`admin`、`service`、`weapp`。没有 npm Workspaces，也没有跨目录共享依赖。每个项目使用自己的 `package.json` 和锁文件，独立安装和构建。根目录的 npm 脚本只方便本地启动；Docker 不使用根目录的 `package-lock.json`。

## 部署结构

```text
little-forest/
├── admin/
│   ├── Dockerfile          # 在 admin 内 npm ci / build，Nginx 提供静态文件
│   ├── .dockerignore
│   └── nginx.conf          # /api/ 转发到 service:3000
├── service/
│   ├── Dockerfile          # 在 service 内 npm ci / build，Node 运行产物
│   ├── .dockerignore
│   ├── scripts/migrate.cjs
│   └── migrations/*.sql
├── weapp/                  # 微信开发者工具构建与发布，不参与 Compose
├── compose.yaml
└── .env.production.example
```

Compose 只创建 `admin` 和 `service`。PostgreSQL 由 1Panel 管理，不重复创建，也不管理数据库的数据卷。

```text
后台域名 → 反向代理 → admin:8080 → /api/* → service:3000 → PostgreSQL:5432
小程序 API 域名 → 反向代理 → service:3000
```

`admin` 与 `service` 通过本项目的 `app` 网络通信。只有 `service` 加入已有的数据库网络，并获取数据库凭证。图片现在保存在数据库字段中，不需要额外挂载上传目录。后端时区固定为 `Asia/Shanghai`，用于预约日期和时段判断。

构建阶段和后端运行镜像使用 Node.js 24；本地单独运行迁移脚本时，建议也使用 Node.js 24，以支持读取 `service/.env`。

## 1. 确认数据库网络与地址

在 1Panel 的「容器 → 网络」确认 PostgreSQL 所在网络，也可以在服务器执行：

```bash
docker network inspect 1panel-network --format '{{range .Containers}}{{println .Name}}{{end}}'
```

`1panel-network` 只是示例。如果 PostgreSQL 在其他网络，使用实际网络名。查询该数据库容器的网络别名：

```bash
docker inspect <数据库容器名> --format '{{json .NetworkSettings.Networks}}'
```

配置 `DB_NETWORK` 为已有网络名，`DB_HOST` 为该网络中的容器名或别名。使用数据库内部端口 `5432`，不使用公网 IP、`localhost` 或宿主机映射端口。Compose 中网络标记为 `external: true`，启动时不会创建它，也不会在停止项目时删除它。

## 2. 配置生产环境

在服务器的仓库根目录执行：

```bash
cp .env.production.example .env.production
chmod 600 .env.production
```

填写实际值：

```dotenv
DB_NETWORK=1panel-network
DB_HOST=实际数据库容器名或别名
DB_PORT=5432
DB_USERNAME=little_forest
DB_PASSWORD='实际密码'
DB_NAME=little_forest
```

数据库和用户须先在 1Panel 创建；该用户需要本业务数据库的建表、建索引、修改表和读写权限。初始化脚本使用 PostgreSQL 13+ 内置的 `gen_random_uuid()`。

密码中的 `$`、`#`、空格可以使用单引号保留；密码包含单引号时按 Docker Compose 的 env 文件规则转义。生产配置已加入 Git 忽略规则，并被各项目的 `.dockerignore` 排除，不会复制进镜像。

Compose 使用 `--env-file .env.production` 读取配置，再通过 `environment` 显式传给后端。单独创建这个文件并不会让 Compose 自动读取。`service/.env` 仍供本地开发使用，不参与 Docker 部署。

## 3. 构建、初始化数据库、启动

以下命令全部在仓库根目录运行：

```bash
# 检查配置是否完整，不打印密码
docker compose --env-file .env.production config --quiet

# 两个构建上下文分别是 ./admin 和 ./service
docker compose --env-file .env.production build

# 首次部署及新增 SQL 迁移后，在启动新版应用前执行
docker compose --env-file .env.production run --rm --no-deps service npm run db:migrate

docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 service admin
```

生产环境的 `NODE_ENV=production` 会关闭 TypeORM 自动同步表结构。迁移命令按文件名顺序执行 SQL，并将成功的文件记录到 `app_schema_migrations`；同一事务执行，有错误时全部回滚，并锁定并发迁移。不要修改已执行的 SQL 文件，后续变更应新增文件。

初始脚本创建当前项目的三个业务表；已有同名表会保留。随后执行原有首页字段迁移。它兼容当前实体结构或仅缺少首页字段的数据库，不会自动修复任意历史表结构。已有数据库更新前，在 1Panel 备份。服务启动后会通过现有代码创建默认门店和预约时段。

检查后台和 API：

```bash
curl -f http://127.0.0.1:8080/
curl -f http://127.0.0.1:8080/api/health
curl -f http://127.0.0.1:3000/api/health
```

## 4. 1Panel 配置与反向代理

1Panel 的数据库页面管理数据库、用户和密码；项目后端凭证在本项目 Compose 配置中维护。修改数据库密码后，同步修改 `.env.production` 并重建后端容器。仅执行容器 `restart` 不会加载新环境变量：

```bash
docker compose --env-file .env.production up -d --force-recreate service
```

需要通过 1Panel 管理编排时，使用「容器 → 编排」从服务器现有 Compose 路径创建，保持仓库目录作为项目目录。确认面板加载了与 `.env.production` 等价的变量；若面板只自动读取 Compose 旁的 `.env`，可以把生产配置命名为根目录 `.env`，上面的命令相应改为 `--env-file .env`。不要把 Compose 内容复制到另一个目录后仍沿用 `./admin`、`./service` 的相对路径。

如果面板不支持为现有路径加载环境文件，使用上面的 SSH 命令部署，1Panel 仍可查看容器和日志；编排编辑和启停能力取决于其创建来源和面板版本。

默认端口绑定宿主机 `127.0.0.1`：后台 `8080`，后端 `3000`。后台容器内 Nginx 也监听 `8080`，默认映射为 `8080:8080`；`.env.production` 中的 `ADMIN_PORT` 只调整宿主机端口。宿主机运行的反向代理，或使用 host 网络的 OpenResty，可将后台域名代理到 `http://127.0.0.1:8080`，将小程序 API 域名代理到 `http://127.0.0.1:3000`。后台 Nginx 会保留 `/api/` 前缀转发到后端，小程序 API 代理也应保留该前缀。

若 OpenResty 在独立的 bridge 网络容器中，`127.0.0.1` 指向 OpenResty 自身。需要将代理与目标容器接入同一网络，通过容器 DNS 访问。例如在仓库根目录创建 `compose.proxy.yaml`：

```yaml
services:
  admin:
    networks:
      app:
      proxy:
        aliases:
          - little-forest-admin
  service:
    networks:
      app:
      database:
      proxy:
        aliases:
          - little-forest-api
networks:
  proxy:
    external: true
    name: 实际OpenResty网络名
```

在此模式下，所有 Compose 命令都追加 `-f compose.yaml -f compose.proxy.yaml`，例如：

```bash
docker compose --env-file .env.production -f compose.yaml -f compose.proxy.yaml up -d
```

此时代理目标分别为 `http://little-forest-admin:8080` 和 `http://little-forest-api:3000`。不用为了容器间通信开放公网端口。外层反向代理的上传大小也应设置为至少 `6m`，否则 5 MiB 图片上传可能被拒绝。

后台现在需要登录，门店设置、图片上传、时段管理和预约记录接口均由后端验证登录会话。小程序公开接口及健康检查不要求后台登录。

默认账号是 `lvyanxiang088@gmail.com`，默认密码是 `19970804`。可在后端 `service/.env`（本地）或根目录 `.env.production`（Docker）配置 `ADMIN_EMAIL`、`ADMIN_PASSWORD`；修改后重启本地后端，或通过 Compose 重建后端容器生效。更换账号或密码后，旧会话自动失效。

登录会话有效期为 12 小时，浏览器通过 `sessionStorage` 保存会话令牌；刷新页面会校验并恢复登录，关闭标签页后需重新登录。数据库仅保存令牌摘要，退出登录会删除当前会话；服务重启不影响未过期会话。连续登录失败会触发限流。线上通过 HTTPS 域名使用后台。

已有部署增加登录功能时，需要同时更新前后端并先执行新增的会话表迁移：

```bash
docker compose --env-file .env.production build service admin
docker compose --env-file .env.production run --rm --no-deps service npm run db:migrate
docker compose --env-file .env.production up -d
```

## 5. 更新与独立构建

普通代码更新：先构建；如果有新增迁移则先运行迁移；最后 `up -d`。只改某个项目时可以单独构建和更新：

```bash
docker compose --env-file .env.production build admin
docker compose --env-file .env.production up -d --no-deps admin

docker compose --env-file .env.production build service
docker compose --env-file .env.production run --rm --no-deps service npm run db:migrate
docker compose --env-file .env.production up -d --no-deps service
```

也可以离开 Compose 独立构建镜像：

```bash
docker build -t little-forest-admin:local ./admin
docker build -t little-forest-service:local ./service
```

后台 Docker 镜像的 `/api/` 默认指向 `service:3000`；单独运行后台容器时，仍需在共同网络提供这个后端 DNS 名称，并将后端 PORT 配置为 3000，或修改 Nginx 配置。

## 参考

微信用户登录、AppSecret、合法域名、隐私指引和小程序发布操作见 [WECHAT_SETUP.md](./WECHAT_SETUP.md)。

- [Docker Compose 环境变量加载](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- [Docker Compose 外部网络](https://docs.docker.com/compose/how-tos/networking/)
- [1Panel 编排管理](https://1panel.pro/docs/v2/user_manual/containers/composes/)
