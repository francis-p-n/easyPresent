export class TextElement {
    constructor(options = {}) {
        this.id = options.id || crypto.randomUUID();
        this.text = options.text || 'New Text';
        
        // Layout Properties
        this.x = options.x !== undefined ? options.x : 0;
        this.y = options.y !== undefined ? options.y : 0;
        this.width = options.width !== undefined ? options.width : 1920;
        this.height = options.height !== undefined ? options.height : 1080;
        
        // Typography
        this.fontFamily = options.fontFamily || 'Inter';
        this.fontSize = options.fontSize || 60;
        this.color = options.color || '#FFFFFF';
        this.bold = options.bold || false;
        this.italic = options.italic || false;
        this.underline = options.underline || false;
        
        // Alignment
        this.hAlign = options.hAlign || 'center'; // left, center, right, justify
        this.vAlign = options.vAlign || 'center'; // top, center, bottom
        this.lineSpacing = options.lineSpacing || 1.35;
        this.textScaling = options.textScaling || 'none'; // none, scaleDown, scaleToFit
        
        // Effects
        this.hasShadow = options.hasShadow || true;
        this.shadowColor = options.shadowColor || 'rgba(0, 0, 0, 0.6)';
        this.shadowOffsetX = options.shadowOffsetX !== undefined ? options.shadowOffsetX : 3;
        this.shadowOffsetY = options.shadowOffsetY !== undefined ? options.shadowOffsetY : 3;
        
        this.strokeWidth = options.strokeWidth || 0;
        this.strokeColor = options.strokeColor || '#000000';
    }

    toJSON() {
        return {
            id: this.id,
            text: this.text,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            fontFamily: this.fontFamily,
            fontSize: this.fontSize,
            color: this.color,
            bold: this.bold,
            italic: this.italic,
            underline: this.underline,
            hAlign: this.hAlign,
            vAlign: this.vAlign,
            lineSpacing: this.lineSpacing,
            textScaling: this.textScaling,
            hasShadow: this.hasShadow,
            shadowColor: this.shadowColor,
            shadowOffsetX: this.shadowOffsetX,
            shadowOffsetY: this.shadowOffsetY,
            strokeWidth: this.strokeWidth,
            strokeColor: this.strokeColor
        };
    }
}
