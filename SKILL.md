# Word Explorer — 项目管控技能

## 项目概述

Go + React 的 LLM 驱动语义关联探索工具。用户输入种子词，LLM 返回关联词，通过多轮迭代探索语义网络，支持集合管理和文章生成。

## 目录结构

```
word-explorer/
├── backend/           # Go HTTP 服务
│   ├── main.go        # 入口，路由，LLM 代理
│   ├── go.mod / go.sum
│   └── static/        # 前端构建产物（自动生成）
├── frontend/          # React + Vite + TypeScript
│   ├── src/
│   │   ├── App.tsx    # 主应用组件
│   │   ├── App.css    # 全部样式
│   │   └── main.tsx   # 入口
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── docs/              # 设计文档
│   ├── 需求文档.md
│   └── 设计文档.md
├── start.sh           # 一键构建+启动
└── SKILL.md           # 本文件
```

## 环境要求

- Go 1.21+
- Node.js 20+
- LLM API Key（OpenRouter 或 DeepSeek）

## 快速启动

```bash
# 构建前端 + 构建后端 + 启动
export OPENROUTER_API_KEY=sk-or-v1-xxx
bash start.sh

# 或分别操作：
# 后端单独启动：
cd backend && OPENROUTER_API_KEY=sk-or-v1-xxx go run main.go

# 前端开发模式（需后端在 :8080 运行）：
cd frontend && npm run dev
```

## 构建与部署

```bash
# 完整构建
cd frontend && npx vite build
cd backend && go build -o app .

# 部署静态文件
rm -rf backend/static && cp -r frontend/dist backend/static

# 运行
cd backend && OPENROUTER_API_KEY=sk-or-v1-xxx ./app
```

## LLM 配置

通过环境变量配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 | — |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（备选） | — |
| `LLM_MODEL` | 模型名称 | `openrouter/free` |
| `LLM_BASE_URL` | API 基础地址 | `https://openrouter.ai/api/v1` |

切换提供商只需设置对应 KEY 和 URL：

```bash
# DeepSeek
export DEEPSEEK_API_KEY=sk-xxx
export LLM_MODEL=deepseek-v4-flash
export LLM_BASE_URL=https://api.deepseek.com/v1

# OpenRouter（默认）
export OPENROUTER_API_KEY=sk-or-v1-xxx
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/explore` | 根据种子词生成 20 个关联词 |
| `POST` | `/api/generate` | 根据词生成短文，支持续写 |
| `POST` | `/api/extract` | 从文本中提取关键词 |
| `GET` | `/` | 静态页面 |

### 请求/响应示例

```json
POST /api/explore
{"words":["AI"],"lang":"en"}
→ {"words":["machine learning","deep learning",...]}

POST /api/generate
{"words":["AI","ML"],"lang":"en","existing":""}
→ {"article":"**title**\\n\\ncontent..."}

POST /api/extract
{"text":"Artificial intelligence is...","lang":"en"}
→ {"words":["Artificial intelligence",...]}
```

## 关键设计决策

1. **无外部 Go 依赖** — 仅使用标准库 `net/http`，便于跨平台编译
2. **单二进制部署** — Go 二进制内嵌静态文件服务，无需额外 web server
3. **gzip 中间件** — 对所有静态文件启用 gzip 压缩
4. **状态存前端** — 集合/偏好均存 localStorage，后端无状态
5. **LLM 调用超时** — HTTP client 45s 超时，防止无限挂起
6. **语言一致性** — LLM prompt 要求输出与输入词/UI 同语言

## 注意事项

- API Key 不要提交到代码仓库（.env 已在 .gitignore 中）
- 前端构建需 Node.js，后端构建需 Go
- 修改前端后需重新 `vite build` 并复制到 `backend/static/`
- 生产环境建议反向代理 nginx + 进程守护（systemd/supervisor）
