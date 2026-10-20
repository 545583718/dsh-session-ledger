// dsh-session-ledger — Host half.
//
// 会话台账：维护一个留底目录（默认 F:\dsh-workspace\project-archive），
// 扫描目录里的会话 .md 文件，暴露两个只读路由给浏览器悬浮图标：
//
//   1. /plugins/dsh-session-ledger/ledger.json —— 会话列表（名称 + 概述 + 状态）
//   2. /plugins/dsh-session-ledger/session?name=xx —— 某个会话的完整留底
//
// 会话留底 .md 由 AI 在会话归档/总结时写入，插件只负责「读」与「展示」，
// 不在启动路径上做任何写操作，也不记录任何密钥。

import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, extname, join, sep } from 'node:path'
import { homedir } from 'node:os'
import z from '@deepseek-ai/schemastery'

/** 路由前缀。 */
const ROUTE = '/plugins/dsh-session-ledger'

/** 留底目录默认值：自动识别 DSH 数据目录（$DSH_HOME 或 ~/.dsh），可配置覆盖。 */
const DEFAULT_ARCHIVE_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'project-archive')

/** 会话 .md 里抽取的字段。 */
const STATUS_ARCHIVED = '已归档'

const LIVE_CAPABLE = typeof z.boolean().volatile === 'function'
function live(schema) {
  return LIVE_CAPABLE ? schema.volatile() : schema
}

const VOLATILE_REF = Symbol.for('cosmokit.volatile.write')
function isLive(value) {
  return typeof value === 'object' && value !== null && VOLATILE_REF in value
}
function readField(config, key) {
  const value = config?.[key]
  return isLive(value) && typeof value.get === 'function' ? value.get() : value
}

/**
 * 会话台账的 Host 配置。
 * 命名空间由 profile 补丁里的条目 id（session-ledger）派生，客户端用同一个字符串配对。
 */
export const Config = z.object({
  enabled: live(z.boolean().default(true)),
  archiveDir: live(z.string().default(DEFAULT_ARCHIVE_DIR)),
})

export const name = 'dsh-session-ledger'
export const inject = ['webServer']

/**
 * 从一份会话 .md 内容里抽取「概述」和「状态」。
 * 概述取 `## 概述` 段落的第一行；状态取 `## 状态` 段落的整行。
 */
function parseSession(content) {
  const overview = /##\s*概述\s*\n\s*([^\n]+)/.exec(content)
  const status = /##\s*状态\s*\n\s*([^\n]+)/.exec(content)
  return {
    overview: overview ? overview[1].trim() : '',
    status: status ? status[1].trim() : '未归档',
  }
}

/**
 * 列出留底目录里的所有会话（排除 INDEX.md），最新在前。
 */
async function listSessions(archiveDir) {
  let entries
  try {
    entries = await readdir(archiveDir, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  const files = entries.filter((e) =>
    e.isFile()
    && e.name.toLowerCase() !== 'index.md'
    && extname(e.name).toLowerCase() === '.md',
  )
  const sessions = await Promise.all(files.map(async (f) => {
    const filePath = join(archiveDir, f.name)
    const content = await readFile(filePath, 'utf8')
    const { overview, status } = parseSession(content)
    const info = await stat(filePath)
    return {
      name: basename(f.name, '.md'),
      file: f.name,
      overview,
      archived: status.includes(STATUS_ARCHIVED),
      status,
      mtime: info.mtimeMs,
    }
  }))
  return sessions.sort((a, b) => b.mtime - a.mtime)
}

function sendJson(res, statusCode, value) {
  const body = Buffer.from(JSON.stringify(value), 'utf8')
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.byteLength),
    'cache-control': 'no-store',
  })
  res.end(body)
}

export function apply(ctx, config) {
  const server = ctx.webServer

  function currentSettings() {
    try {
      return {
        enabled: readField(config, 'enabled') ?? true,
        archiveDir: readField(config, 'archiveDir') ?? DEFAULT_ARCHIVE_DIR,
      }
    } catch {
      return { enabled: true, archiveDir: DEFAULT_ARCHIVE_DIR }
    }
  }

  // 会话列表
  ctx.effect(() => server.register({
    kind: 'exact',
    path: `${ROUTE}/ledger.json`,
    handler: (req, res) => {
      void (async () => {
        const { archiveDir } = currentSettings()
        const sessions = await listSessions(archiveDir)
        sendJson(res, 200, { sessions })
      })().catch((error) => {
        ctx.logger?.error?.('session-ledger: ledger route failed', error)
        if (!res.headersSent) sendJson(res, 500, { error: 'internal' })
        else res.end()
      })
    },
  }), 'session-ledger: ledger route')

  // 单个会话详情（只读，路径做包容性校验）
  ctx.effect(() => server.register({
    kind: 'prefix',
    path: `${ROUTE}/session`,
    handler: (req, res) => {
      void (async () => {
        const { archiveDir } = currentSettings()
        const requested = new URL(req.url ?? '/', 'http://localhost').searchParams.get('name') ?? ''
        const file = basename(requested)
        if (file === '' || file !== requested || extname(file).toLowerCase() !== '.md') {
          sendJson(res, 400, { error: '会话名不合法。' })
          return
        }
        const absolute = join(archiveDir, file)
        if (!absolute.startsWith(archiveDir + sep)) {
          sendJson(res, 400, { error: '会话名不合法。' })
          return
        }
        try {
          const content = await readFile(absolute, 'utf8')
          sendJson(res, 200, { name: basename(file, '.md'), content })
        } catch (error) {
          if (error?.code === 'ENOENT') {
            sendJson(res, 404, { error: '会话不存在。' })
            return
          }
          throw error
        }
      })().catch((error) => {
        ctx.logger?.error?.('session-ledger: session route failed', error)
        if (!res.headersSent) sendJson(res, 500, { error: 'internal' })
        else res.end()
      })
    },
  }), 'session-ledger: session route')
}
