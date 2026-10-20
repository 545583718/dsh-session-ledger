window.__ModuleLoader__.load({ id: "dsh-session-ledger", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
// dsh-session-ledger — browser half.
//
// 左上角悬浮图标：纯 DOM，长按拖动（位置记忆到 localStorage），点击展开会话列表。
// 图标尺寸用 vw 相对单位等比缩放（窗口缩小图标跟着缩）。
// 位置在「未拖动」时锚定 DSH 侧边栏：用 ResizeObserver 监听侧边栏，收起/展开宽度一变，
// 悬浮窗自动重新贴到侧边栏右边缘 + 5px、「对话」标题下方 + 5px。拖动一次后固定（记忆位置），
// 不再跟随，但尺寸仍等比缩放。首次使用弹窗提醒 token 消耗。

const LEDGER = '/plugins/dsh-session-ledger/ledger.json'
const STYLE_ID = 'dsh-session-ledger-style'
const NOTIFIED_KEY = 'dsh-session-ledger:notified'
const POSITION_KEY = 'dsh-session-ledger:position'

const CSS = [
  // 图标尺寸用 vw：窗口缩放时等比缩小，clamp 限制最小 26px / 最大 44px
  '.dsl-float{position:fixed;left:6px;top:12px;z-index:99990;',
  'width:clamp(26px,3.2vw,44px);height:clamp(26px,3.2vw,44px);',
  'border-radius:26%;background:#141d2e;border:1.5px solid #58a6ff;cursor:grab;',
  'display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(0,0,0,.4);',
  'transition:transform .25s,box-shadow .15s;padding:0;touch-action:none}',
  '.dsl-float:hover{box-shadow:0 4px 18px rgba(88,166,255,.3)}',
  '.dsl-float.dragging{cursor:grabbing;box-shadow:0 6px 24px rgba(88,166,255,.4);transform:scale(1.18);transition:none}',
  '.dsl-float svg{width:58%;height:58%;display:block;pointer-events:none}',
  '.dsl-panel{position:fixed;z-index:99989;width:min(300px,72vw);max-height:70vh;overflow-y:auto;',
  'background:#141d2e;border:1px solid #2a3a4d;border-radius:14px;',
  'box-shadow:0 8px 32px rgba(0,0,0,.5);padding:11px;display:none}',
  '.dsl-panel[data-open="1"]{display:block}',
  '.dsl-head{font-size:12.5px;color:#8b98a9;margin-bottom:9px;padding:0 4px;letter-spacing:.5px}',
  '.dsl-item{padding:8px 9px;border-radius:9px;cursor:pointer;margin-bottom:2px;',
  'transition:background .12s}',
  '.dsl-item:hover{background:rgba(88,166,255,.12)}',
  '.dsl-name{font-size:13px;color:#e6edf3;font-weight:600;display:flex;align-items:center;gap:7px;min-width:0}',
  '.dsl-dot{width:7px;height:7px;border-radius:50%;flex:none}',
  '.dsl-dot.on{background:#58a6ff}',
  '.dsl-dot.off{background:#6b7280}',
  '.dsl-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
  '.dsl-overview{font-size:12px;color:#9aa7b8;margin-top:2px;line-height:1.45;',
  'display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}',
  '.dsl-empty{font-size:12.5px;color:#6b7280;padding:13px;text-align:center}',
  '.dsl-tip{position:fixed;z-index:99992;max-width:280px;background:#141d2e;border:1px solid #58a6ff;border-radius:9px;padding:8px 11px;font-size:12.5px;color:#e6edf3;line-height:1.55;box-shadow:0 4px 18px rgba(0,0,0,.5);display:none;pointer-events:none}',
  '.dsl-tip[data-open="1"]{display:block}',
  '.dsl-toast{position:fixed;left:50%;top:20px;transform:translateX(-50%);z-index:99991;',
  'background:#141d2e;border:1px solid #58a6ff;border-radius:12px;padding:14px 18px;',
  'max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,.5);font-size:13px;color:#e6edf3;',
  'line-height:1.7;display:none}',
  '.dsl-toast[data-open="1"]{display:block}',
  '.dsl-toast b{color:#f0b429}',
  '.dsl-toast button{margin-top:10px;background:#58a6ff;color:#0d1117;border:0;border-radius:7px;',
  'padding:6px 16px;font-size:12.5px;font-weight:600;cursor:pointer}',
].join('')

const ICON_SVG = '<svg viewBox="0 0 48 48">'
  + '<rect x="5" y="5" width="38" height="38" rx="10" fill="none" stroke="#58a6ff" stroke-width="2"/>'
  + '<circle cx="13" cy="14" r="3.2" fill="#58a6ff"/>'
  + '<line x1="21" y1="14" x2="36" y2="14" stroke="#8b98a9" stroke-width="2.6" stroke-linecap="round"/>'
  + '<line x1="13" y1="23" x2="36" y2="23" stroke="#7ee2df" stroke-width="2.6" stroke-linecap="round"/>'
  + '<line x1="13" y1="32" x2="28" y2="32" stroke="#8b98a9" stroke-width="2.6" stroke-linecap="round"/>'
  + '</svg>'

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  })
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)
}

function buildIcon() {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'dsl-float'
  button.title = '会话台账'
  button.setAttribute('aria-label', '打开会话台账')
  button.innerHTML = ICON_SVG
  return button
}

function buildPanel() {
  const panel = document.createElement('div')
  panel.className = 'dsl-panel'
  const head = document.createElement('div')
  head.className = 'dsl-head'
  head.textContent = '会话台账'
  panel.appendChild(head)
  return panel
}

function buildToast(onConfirm) {
  const toast = document.createElement('div')
  toast.className = 'dsl-toast'
  const text = document.createElement('div')
  text.innerHTML = '已启用「会话台账」：本会话结束后会由 AI 生成一句话总结与详细留底，'
    + '<b>会消耗少量 token</b>（一次约几百 token）。留底只存文字，不记录任何密钥。'
  toast.appendChild(text)
  const ok = document.createElement('button')
  ok.type = 'button'
  ok.textContent = '知道了'
  ok.addEventListener('click', function () {
    toast.remove()
    onConfirm()
  })
  toast.appendChild(ok)
  return toast
}

function clearList(panel) {
  while (panel.children.length > 1) {
    panel.removeChild(panel.lastChild)
  }
}

function appendEmpty(panel, message) {
  const empty = document.createElement('div')
  empty.className = 'dsl-empty'
  empty.textContent = message
  panel.appendChild(empty)
}

let tipEl = null
function ensureTip() {
  if (tipEl === null) {
    tipEl = document.createElement('div')
    tipEl.className = 'dsl-tip'
    document.body.appendChild(tipEl)
  }
  return tipEl
}

function loadSessions(panel) {
  fetch(LEDGER, { cache: 'no-store' })
    .then(function (response) {
      return response.ok ? response.json() : { sessions: [] }
    })
    .then(function (payload) {
      const sessions = Array.isArray(payload.sessions) ? payload.sessions : []
      clearList(panel)
      if (sessions.length === 0) {
        appendEmpty(panel, '还没有会话留底')
        return
      }
      for (const session of sessions) {
        const item = document.createElement('div')
        item.className = 'dsl-item'
        const name = document.createElement('div')
        name.className = 'dsl-name'
        const dot = '<span class="dsl-dot ' + (session.archived ? 'off' : 'on') + '"></span>'
        const title = '<span class="dsl-title">' + escapeHtml(session.name) + '</span>'
        name.innerHTML = dot + title
        item.appendChild(name)
        if (session.overview) {
          const overview = document.createElement('div')
          overview.className = 'dsl-overview'
          overview.textContent = session.overview
          item.appendChild(overview)
        }
        let tipTimer = null
        item.addEventListener('mouseenter', function () {
          tipTimer = setTimeout(function () {
            const tip = ensureTip()
            tip.textContent = session.overview || session.name
            const rect = item.getBoundingClientRect()
            tip.style.left = Math.round(rect.left) + 'px'
            tip.style.top = Math.round(rect.bottom + 4) + 'px'
            tip.setAttribute('data-open', '1')
          }, 1000)
        })
        item.addEventListener('mouseleave', function () {
          clearTimeout(tipTimer)
          if (tipEl !== null) tipEl.setAttribute('data-open', '0')
        })
        panel.appendChild(item)
      }
    })
    .catch(function () {
      clearList(panel)
      appendEmpty(panel, '读取失败')
    })
}

/** 找侧边栏列（会话列表组件）。 */
function findSidebarCol() {
  return document.querySelector('[class*="sidebarCol"]')
}

/** 找「对话」标题元素。 */
function findChatHeading() {
  const candidates = document.querySelectorAll('div,span,h1,h2,h3,h4,button,a')
  for (const el of candidates) {
    if (el.children.length === 0 && el.textContent.trim() === '对话') {
      return el
    }
  }
  return null
}

/** 把悬浮窗贴到侧边栏右边缘 +「对话」下方，各留 5px。 */
function anchorToSidebar(icon) {
  try {
    const sidebarCol = findSidebarCol()
    if (sidebarCol !== null) {
      const rect = sidebarCol.getBoundingClientRect()
      if (rect.width > 0 && rect.right > 0) {
        icon.style.left = Math.round(rect.right + 5) + 'px'
      }
    }
    const heading = findChatHeading()
    if (heading !== null) {
      const rect = heading.getBoundingClientRect()
      if (rect.height > 0 && rect.bottom > 0) {
        icon.style.top = Math.round(rect.bottom + 5) + 'px'
      }
    }
  } catch (error) {
    // 定位失败保持原位。
  }
}

function loadSavedPosition() {
  try {
    const raw = localStorage.getItem(POSITION_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        return { x: parsed.x, y: parsed.y }
      }
    }
  } catch (error) {
    // 忽略，走锚点。
  }
  return null
}

exports.apply = function apply() {
  try {
    ensureStyle()
    const icon = buildIcon()
    const panel = buildPanel()
    document.body.appendChild(panel)
    document.body.appendChild(icon)

    let following = true  // 未拖动 = 跟随侧边栏

    // 初始位置：记忆位置优先（固定）；否则锚点跟随
    const saved = loadSavedPosition()
    if (saved !== null) {
      icon.style.left = saved.x + 'px'
      icon.style.top = saved.y + 'px'
      following = false
    } else {
      anchorToSidebar(icon)
    }

    // 跟随：ResizeObserver 监听侧边栏（收起/展开宽度变化）+ 窗口 resize
    function observeSidebar() {
      const sidebarCol = findSidebarCol()
      if (sidebarCol !== null && typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(function () {
          if (following) anchorToSidebar(icon)
        })
        observer.observe(sidebarCol)
      }
    }
    // 侧边栏可能是异步渲染的，等它出现后再监听（尝试几次）
    let attempts = 0
    const tryObserve = setInterval(function () {
      attempts += 1
      if (findSidebarCol() !== null || attempts > 40) {
        clearInterval(tryObserve)
        observeSidebar()
      }
    }, 250)
    window.addEventListener('resize', function () {
      if (following) anchorToSidebar(icon)
    })

    // 「对话」标题是异步渲染的，首次定位时可能还没出现，悬浮窗会先贴到默认顶部、
    // 等标题出来后就盖住它。用 MutationObserver 等标题出现后重新贴，并延迟再贴一次等布局稳定。
    if (typeof MutationObserver !== 'undefined') {
      let located = false
      const chatObserver = new MutationObserver(function () {
        if (!following || located) return
        if (findChatHeading() !== null) {
          located = true
          anchorToSidebar(icon)
          setTimeout(function () {
            if (following) anchorToSidebar(icon)
          }, 1000)
          chatObserver.disconnect()
        }
      })
      chatObserver.observe(document.body, { childList: true, subtree: true })
    }

    // 长按拖动：lerp 平滑跟随（不生硬）+ 拖起放大回弹；拖动后停止跟随
    let press = null
    let suppressClick = false
    let dragTarget = null
    let animFrame = null

    function stopSmooth() {
      if (animFrame !== null) {
        cancelAnimationFrame(animFrame)
        animFrame = null
      }
      dragTarget = null
    }

    function smoothDrag() {
      if (dragTarget === null) {
        animFrame = null
        return
      }
      const rect = icon.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const nx = cx + (dragTarget.x - cx) * 0.45
      const ny = cy + (dragTarget.y - cy) * 0.45
      icon.style.left = Math.max(0, Math.round(nx - icon.offsetWidth / 2)) + 'px'
      icon.style.top = Math.max(0, Math.round(ny - icon.offsetHeight / 2)) + 'px'
      animFrame = requestAnimationFrame(smoothDrag)
    }

    icon.addEventListener('pointerdown', function (event) {
      press = {
        lastX: event.clientX,
        lastY: event.clientY,
        dragging: false,
        timer: setTimeout(function () {
          press.dragging = true
          icon.classList.add('dragging')
          // 展开状态先收起，避免拖动时面板干扰
          panel.setAttribute('data-open', '0')
          // 锁定鼠标在图标中心：把图标中心移到鼠标当前位置，拖动起点不跳变
          icon.style.left = Math.max(0, Math.round(press.lastX - icon.offsetWidth / 2)) + 'px'
          icon.style.top = Math.max(0, Math.round(press.lastY - icon.offsetHeight / 2)) + 'px'
          dragTarget = { x: press.lastX, y: press.lastY }
        }, 280),
      }
    })
    window.addEventListener('pointermove', function (event) {
      if (press !== null) {
        press.lastX = event.clientX
        press.lastY = event.clientY
      }
      if (press === null || press.dragging !== true) return
      dragTarget = { x: event.clientX, y: event.clientY }
      if (animFrame === null) smoothDrag()
    })
    window.addEventListener('pointerup', function () {
      if (press === null) return
      clearTimeout(press.timer)
      const wasDragging = press.dragging
      press = null
      icon.classList.remove('dragging')
      stopSmooth()
      if (wasDragging) {
        // 磁吸：松手时若图标落在侧边栏附近（48px 内），吸附回锚点并恢复跟随
        const sidebarCol = findSidebarCol()
        let snapped = false
        if (sidebarCol !== null) {
          const srect = sidebarCol.getBoundingClientRect()
          const irect = icon.getBoundingClientRect()
          if (Math.abs(irect.left - (srect.right + 5)) < 48) {
            snapped = true
          }
        }
        if (snapped) {
          following = true
          anchorToSidebar(icon)
        } else {
          following = false
        }
        try {
          const rect = icon.getBoundingClientRect()
          localStorage.setItem(POSITION_KEY, JSON.stringify({ x: Math.round(rect.left), y: Math.round(rect.top) }))
        } catch (error) {
          // 存不了就不存。
        }
        suppressClick = true
        setTimeout(function () { suppressClick = false }, 0)
      }
    })

    icon.addEventListener('click', function () {
      if (suppressClick) return
      const open = panel.getAttribute('data-open') === '1'
      if (open) {
        panel.setAttribute('data-open', '0')
      } else {
        const rect = icon.getBoundingClientRect()
        panel.style.left = Math.round(rect.right + 5) + 'px'
        panel.style.top = Math.round(rect.top) + 'px'
        panel.setAttribute('data-open', '1')
        loadSessions(panel)
      }
    })

    // 首次使用弹窗
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(NOTIFIED_KEY) !== '1') {
        const toast = buildToast(function () {
          try { localStorage.setItem(NOTIFIED_KEY, '1') } catch (error) { /* 忽略 */ }
        })
        document.body.appendChild(toast)
        toast.setAttribute('data-open', '1')
      }
    } catch (error) {
      // localStorage 不可用就不弹。
    }
  } catch (error) {
    console.warn('session-ledger: client half failed', error)
  }
}

return module.exports; } });
