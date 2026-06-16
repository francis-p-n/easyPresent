export class VirtualScroller {
  constructor(container, options = {}) {
    this.container = container
    this.getItemHeight = options.getItemHeight || (() => 40)
    this.renderItem = options.renderItem
    this.updateItem = options.updateItem
    this.buffer = options.buffer || 5
    this.items = []

    // Make container scrollable if not already
    this.container.style.overflowY = 'auto'
    this.container.style.position = 'relative'

    this.scroller = document.createElement('div')
    this.scroller.style.position = 'relative'
    this.scroller.style.width = '100%'
    this.container.appendChild(this.scroller)

    this.renderedItems = new Map()
    this.itemPositions = []
    this.totalHeight = 0

    this.container.addEventListener('scroll', () => {
      window.requestAnimationFrame(() => this._render())
    })

    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        if (this.container.clientHeight > 0) this._render()
      })
      observer.observe(this.container)
    }
  }

  setItems(items) {
    this.items = items
    this.itemPositions = []
    this.totalHeight = 0

    for (let i = 0; i < items.length; i++) {
      const h = this.getItemHeight(items[i], i)
      this.itemPositions.push({ top: this.totalHeight, height: h })
      this.totalHeight += h
    }

    this.scroller.style.height = `${this.totalHeight}px`

    // Clear removed items
    for (const [index, el] of this.renderedItems.entries()) {
      if (index >= items.length) {
        el.remove()
        this.renderedItems.delete(index)
      }
    }

    this._render()
  }

  _render() {
    if (!this.items.length) {
      this.scroller.innerHTML = ''
      this.renderedItems.clear()
      return
    }

    const scrollTop = this.container.scrollTop
    const containerHeight = this.container.clientHeight || 500

    // Linear search for start index
    let startIndex = 0
    for (let i = 0; i < this.itemPositions.length; i++) {
      if (this.itemPositions[i].top + this.itemPositions[i].height > scrollTop) {
        startIndex = Math.max(0, i - this.buffer)
        break
      }
    }

    let endIndex = this.items.length - 1
    for (let i = startIndex; i < this.itemPositions.length; i++) {
      if (this.itemPositions[i].top > scrollTop + containerHeight) {
        endIndex = Math.min(this.items.length - 1, i + this.buffer)
        break
      }
    }

    // Remove out of bounds
    for (const [index, el] of this.renderedItems.entries()) {
      if (index < startIndex || index > endIndex) {
        el.remove()
        this.renderedItems.delete(index)
      }
    }

    // Render in bounds
    for (let i = startIndex; i <= endIndex; i++) {
      const pos = this.itemPositions[i]
      if (!this.renderedItems.has(i)) {
        const item = this.items[i]
        const el = this.renderItem(item, i)
        el.style.position = 'absolute'
        el.style.top = `${pos.top}px`
        el.style.left = '0'
        el.style.right = '0'
        el.style.height = `${pos.height}px`
        this.scroller.appendChild(el)
        this.renderedItems.set(i, el)
      } else {
        if (this.updateItem) {
          const el = this.renderedItems.get(i)
          el.style.top = `${pos.top}px`
          el.style.height = `${pos.height}px`
          this.updateItem(el, this.items[i], i)
        }
      }
    }
  }
}
