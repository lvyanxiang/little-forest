# 小森林管理后台

独立的 React + TypeScript + Vite 项目，使用本目录的 `package.json` 和 `package-lock.json`。

## 本地开发

在 `admin` 目录执行：

```bash
npm ci
cp .env.example .env.local
npm run dev
```

默认后台地址是 `http://localhost:5174`。浏览器请求 `/api/...`，Vite 按 `API_PROXY_TARGET` 转发到后端。

在 `admin/.env.local` 中配置后端地址，例如：

```dotenv
API_PROXY_TARGET=http://127.0.0.1:3000
```

本地直接运行后端时，对应 `service/.env` 的 `PORT`，例如 `PORT=3000`。如果访问 Docker 后端，对应宿主机映射端口 `SERVICE_PORT`；后端容器内部端口可以不同。地址只填写协议、主机和端口，不追加 `/api`。

修改配置后重启 `npm run dev`。也可以从仓库根目录执行 `npm run dev:admin`。后端单独通过 `npm run dev:service` 启动。

`.env.local` 已被 Git 忽略；`.env.example` 提供默认配置供新环境复制。`API_PROXY_TARGET` 仅供 Vite 代理使用，不注入浏览器代码。

## 构建与部署

后台需要管理员登录，账号和密码由后端 `ADMIN_EMAIL`、`ADMIN_PASSWORD` 配置；默认凭据见仓库部署文档。登录会话有效期为 12 小时，刷新页面保留登录状态，关闭标签页后需重新登录。侧栏提供退出登录，登录过期时自动返回登录页。生产数据库需要执行新增的登录会话表迁移。

```bash
npm run build
```

构建产物在 `dist`。生产 Docker 部署通过 Nginx 转发 API，本地 Vite 代理配置不影响生产 Nginx。部署步骤见仓库根目录的 [DEPLOYMENT.md](../DEPLOYMENT.md)。
