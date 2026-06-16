import { icon } from '../../../components/common/Icons.js'

export function renderMessages(content) {
  content.innerHTML = `
    <div class="show-controls-section">
      <div class="message-form">
        <input type="text" class="input" placeholder="Enter message text..." id="message-input" />
        <button class="btn btn--primary" id="message-show">Show</button>
        <button class="btn" id="message-hide">Hide</button>
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
}
