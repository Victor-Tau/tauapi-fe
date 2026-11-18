# Victor API 控制台（React + shadcn/ui）

根目录 Vue 控制台的重构版本：React 19 + Vite + TypeScript，界面全部使用 shadcn/ui（`base-nova`，Base UI）。

## 启动

```bash
npm install
npm run dev        # http://127.0.0.1:5174
```

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器，端口 5174（旧版 Vue 工程用 5173，可同时运行对比） |
| `npm run build` | 类型检查 + 生产构建，输出到 `dist/` |
| `npm run preview` | 预览生产构建，端口 4174 |
| `npm run typecheck` | 仅类型检查 |
| `npm run lint` | ESLint |

开发服务器绑定 `127.0.0.1`：登录密码在浏览器内用 Web Crypto 加密，必须在 HTTPS 或 localhost 下运行。

## 后端代理

开发环境下 `/api` 由 Vite 代理到 `API_PROXY_TARGET`（见 `.env.development`，默认 `http://43.173.126.193:3000`）。该变量只在 `vite.config.ts` 中读取，不会打包进前端代码。临时指向其他后端：

```bash
API_PROXY_TARGET=http://localhost:3000 npm run dev
```

## 生产部署

`dist/` 是纯静态文件，部署时需要：

1. **同源反向代理 `/api`** 到后端。刷新凭据是 httpOnly Cookie，前端请求全部使用相对路径 `/api/...`，不能跨域部署。
2. **SPA 回退**：所有未命中静态文件的路径返回 `index.html`（客户端路由）。

Nginx 示例：

```nginx
location /api/ {
  proxy_pass http://backend:3000;
  proxy_set_header Host $host;
}
location / {
  root /srv/api-console/dist;
  try_files $uri /index.html;
}
```

## 目录

```
src/
├── api/ types/ utils/    # 从 Vue 工程迁移的接口层与工具函数（逻辑未改动）
├── lib/                  # QueryClient 与 query key、路由辅助、密钥表单 schema
├── hooks/                # 登录态（useSyncExternalStore）、各接口的 query hook
├── components/ui/        # 由 shadcn CLI 生成后按设计系统手工调整过（文件头有说明）；重新 add 会覆盖这些修改，需要手动合并
├── components/app-shell/ # 侧栏展开状态、悬停防抖等外壳逻辑
├── styles/               # motion.css（缓动、浮层进出、骨架扫光）、shell.css（侧栏与右上角状态卡）
├── components/           # 侧栏、顶栏、统计卡、分页等通用组件
├── layouts/app-layout.tsx
├── pages/                # 登录、总览、API 密钥、用量记录、个人信息、404（按路由懒加载）
└── router.tsx            # 路由表、登录守卫、页面标题
```

## 约定

- 登录态只存在内存里的 `ApiClient`（`src/api/request.ts`），React 通过 `useAuth()` 订阅；身份变化时自动清空除站点配置外的全部查询缓存。
- 服务端数据统一走 TanStack Query：`/api/status` 全局共享 5 分钟，个人资料在页面间共享，卸载即取消请求；只有网络错误、429、5xx 会自动重试一次。
- 完整密钥（查看密钥）和编辑前的密钥详情直接请求、不进入缓存；关闭弹窗即从内存清除。
- 主题偏好保存在 `localStorage` 的 `api-console-theme`（与旧版同名），只有浅色 / 深色两档，点右上角圆形按钮切换；首次访问按系统偏好决定初始值。
- 视觉 token（色阶、圆角、字重补偿、缓动、阴影）集中在 `src/index.css`，设计基准是根目录的 `demo.html`。

## 参考文档之外的接口

「模型列表」页面用到两个 `newapi_backend_api_reference_for_claude.md` 未收录的只读接口，字段已按上游源码（QuantumNous/new-api）与部署实例的实际回包核对：

| 方法 | 路径 | 用途 | 说明 |
|---|---|---|---|
| GET | `/api/pricing` | 模型价格、厂商、分组倍率、接口类型 | `vendors`、`group_ratio`、`supported_endpoint` 与 `data` 同级返回；价格表达式（`billing_mode: "tiered_expr"`）的系数为美元 / 1M tokens，`fixed(x)` 为美元 / 次 |
| GET | `/api/perf-metrics/summary?hours=24` | 各模型近 24 小时成功率、平均耗时、输出速度 | 只包含有调用的模型；不提供首响耗时（TTFT） |

价格表达式只解析 `[条件 ?] tier("名称", p * x + c * y …) [: …]` 与 `fixed(x)` 两种形式，其余表达式在页面上原样展示。
