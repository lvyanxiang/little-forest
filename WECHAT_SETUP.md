# 微信用户与后台内容同步

## 已实现的内容

后台配置现在对应小程序的实际页面：

| 后台 | 小程序展示 / 使用位置 |
| --- | --- |
| 首页图片、右侧文案 | 首页主图和文字 |
| 到店须知标题、列表、结尾 | 首页须知弹窗和预约表单 |
| 预约成功提示 | 预约成功页「到店请留意」 |
| 到店地址 | 预约成功页地址 |
| 闭馆星期 | 日期选择、日历及后端预约校验 |
| 时段时间、名额、排序、上下线 | 预约页时段列表及剩余名额 |
| 预约记录 | 「我的」即将到来、历史记录 |

后台已移除未展示的店名、门店电话、营业时间、地图及坐标配置，移除预约记录中的人数展示。历史数据库字段和业务记录保留，不执行删库或清空数据。接口不再返回这些废弃门店配置。

「我的」支持微信登录、完善头像昵称、退出登录和预约历史。登录采用 `wx.login` → 服务端 `code2Session` → 本项目会话，默认会话有效期 30 天；服务端仅存会话令牌摘要，AppSecret、OpenID、session_key 不下发到小程序。头像由用户通过 `chooseAvatar` 选择，昵称通过 `input type="nickname"` 填写，不调用旧版 `getUserProfile`。头像上限 2MB，保存到 PostgreSQL，并通过需要登录的接口读取。

预约表单仍由用户填写姓名和手机号。微信身份登录不会自动取得手机号，本次没有接入微信手机号获取能力。已填写的昵称可以预填预约姓名，用户仍可修改。

## 你需要完成的操作

### 1. 核对 AppID，取得 AppSecret

登录 [微信公众平台](https://mp.weixin.qq.com/)，进入当前小程序的开发设置，核对 AppID 并取得 AppSecret。仓库 `weapp/project.config.json` 当前 AppID 是 `wxad07ff9a9da66484`，须与服务器配置属于同一个小程序。

AppSecret 只填写到服务器或本地后端的环境文件，不放进小程序代码、不提交 Git。无需在聊天里发送密钥。

服务器仓库根目录 `.env.production` 添加：

```dotenv
WECHAT_APPID=wxad07ff9a9da66484
WECHAT_APP_SECRET='这里填写实际AppSecret'
SERVICE_PORT=3000
```

本地开发填在 `service/.env`。配置缺失时，首页、须知、时段仍可浏览；微信登录和提交预约会提示管理员尚未配置登录。

### 2. 设置 HTTPS API 域名

在 1Panel 将 API 域名反向代理到后端实际宿主机端口，并配置有效的 HTTPS 证书。代理需要保留 `/api/` 前缀，上传大小至少 `6m`。

编辑 `weapp/miniprogram/utils/config.ts`：

```typescript
export const DEVELOP_API_BASE = 'http://127.0.0.1:3001/api'
export const PRODUCTION_API_BASE = 'https://你的API域名/api'
```

开发版使用 `DEVELOP_API_BASE`；体验版和正式版使用 `PRODUCTION_API_BASE`。本地后端若改为 3000，开发地址也改为 3000。真机开发版的 `127.0.0.1` 指向手机自身，真机测试时将开发地址改为可访问的 HTTPS API 地址。

在微信公众平台将同一 API 域名配置为 `request`、`uploadFile`、`downloadFile` 合法域名。平台的合法域名填写域名，例如 `https://api.example.cn`，不带 `/api`。图片上传和登录后的头像下载都使用该域名；首页图片也需要确保可在真机加载。

### 3. 更新用户隐私保护指引

在公众平台的用户隐私保护指引中声明实际收集内容和用途：账号标识用于登录及同步预约；用户主动选择的头像、填写的昵称用于个人资料；预约姓名和用户自行填写的手机号用于到店预约和联系。按平台提供的分类填写，并提供实际的联系 / 信息删除渠道。

代码已添加隐私指引入口、头像隐私授权弹窗，以及 `agreePrivacyAuthorization` 同意按钮。微信平台上的隐私指引仍须由你配置，代码不能替代这一步。不选择头像昵称可以继续以默认「书友」身份预约。

### 4. 更新服务器和数据库

先在 1Panel 备份当前业务数据库，再在服务器仓库根目录运行：

```bash
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build admin service
docker compose --env-file .env.production run --rm --no-deps service npm run db:migrate
docker compose --env-file .env.production up -d
```

迁移创建 `wechat_users`、`wechat_sessions`，并给预约表增加 `userId`；它可重复运行。`up -d` 不会自动迁移，必须执行上述迁移命令。

后台 Nginx 当前转发到 `service:3000`；你的 Compose 后端内部端口必须与它一致。若部署使用 `SERVICE_PORT=3001`，需要同时修改 Nginx 的后端端口并重建 admin；如果仍使用 3000，保持现有配置即可。

### 5. 用微信开发者工具和真机验证、重新发布

开发者工具打开 `weapp`，选择支持头像昵称及隐私能力的正式基础库（至少 2.32.3，建议当前稳定版），不要继续使用仓库当前的 `trial` 基础库设置。模拟器调试本地 HTTP 可以临时关闭域名校验，体验版 / 正式版须使用已经配置的合法 HTTPS 域名。

在体验版和真机检查：

1. 未登录可以浏览首页、须知和时段。
2. 「我的」点击微信登录，完善头像昵称；拒绝头像授权后仍能使用默认资料。
3. 关闭并重新进入小程序后，个人资料和当前微信账号的预约仍可恢复。
4. 提交预约后「我的」出现记录，取消后名额释放；换另一个微信账号不会看到或取消第一个账号的预约。
5. 在 admin 修改首页图片、文案、须知、地址、闭馆日期和时段，重新进入小程序核对展示。
6. 退出登录后个人预约列表和角标清空，重新登录后恢复自己的记录。

验证后上传小程序新版本，按公众平台流程提交审核、发布。只更新 Docker 不会更新已经发布的小程序代码。请同时安排后端和小程序的升级，旧版匿名预约客户端不再支持提交、读取或取消预约。

## 已有匿名预约

旧记录继续留在 admin，但旧版的本机随机 `clientId` 无法证明属于哪个微信账号，因此不会自动关联；相同手机号也不会直接认领。若确实需要归属旧记录，需由管理员核验后再安排一次人工迁移，避免用户通过伪造 ID 或手机号查看别人的预约。

## 验证范围

接口测试使用模拟微信 `code2Session` 响应，真实 PostgreSQL 验证用户、私有头像、登录会话、预约归属、跨账号拒绝访问以及历史记录保留。真实微信登录、授权弹窗和体验版合法域名需要填写真实 AppSecret 并在真机完成验证。

## 官方参考

- [微信小程序登录流程](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/login.html)
- [code2Session](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html)
- [微信官方头像昵称组件说明](https://github.com/wechat-miniprogram/mp-user-avatar)
- [用户隐私保护指引与授权](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)
