import { icon } from '../../../components/common/Icons.js'

// The tab is rebuilt every time it is opened, so the half-typed message lives here
let messageDraft = ''

export function renderMessages(content) {
  content.innerHTML = `
    <div class="show-controls-section">
      <div class="message-form">
        <input type="text" class="input" placeholder="Enter message text..." id="message-input" />
        <button class="btn btn--primary" id="message-show">Show</button>
        <button class="btn" id="message-hide">Hide</button>
      </div>
      <div class="message-hint" style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-secondary);line-height:1.4;">
        <button class="btn" id="message-insert-timer" title="Add the running countdown to this message" style="height:24px;padding:0 8px;flex-shrink:0;">+ Timer</button>
        <span>Use <code>{timer}</code> to show the countdown from the Timers tab, e.g. "Starting in {timer}". Start the countdown first.</span>
      </div>
      <div class="message-templates">
        <div class="list-item" data-msg="Welcome! We're glad you're here.">
          ${icon('messageSquare', 14).outerHTML}
          <span>Welcome Message</span>
        </div>
        <div class="list-item" data-msg="Service starting in {timer}">
          ${icon('messageSquare', 14).outerHTML}
          <span>Service Starting</span>
        </div>
        <div class="list-item" data-msg="Please silence your phones">
          ${icon('messageSquare', 14).outerHTML}
          <span>Silence Phones</span>
        </div>
      </div>
    </div>
  `

  const input = content.querySelector('#message-input')
  input.value = messageDraft
  input.addEventListener('input', () => {
    messageDraft = input.value
  })

  // "+ Timer" drops {timer} into the message where the cursor is
  content.querySelector('#message-insert-timer')?.addEventListener('click', () => {
    const token = '{timer}'
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    input.value = input.value.slice(0, start) + token + input.value.slice(end)
    input.focus()
    input.setSelectionRange(start + token.length, start + token.length)
    messageDraft = input.value
  })
}
