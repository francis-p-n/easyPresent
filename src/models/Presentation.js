import { Slide } from './Slide.js';

export class Presentation {
    constructor(options = {}) {
        this.id = options.id || crypto.randomUUID();
        this.name = options.name || 'New Presentation';
        this.category = options.category || 'Presentation';
        this.lastModified = options.lastModified || new Date().toISOString();
        
        // Theme Reference
        this.themeId = options.themeId || null;
        
        // Global Presentation Transitions
        this.transition = options.transition || {
            type: 'dissolve',
            duration: 0.5
        };

        // Master Slides array
        this.slides = options.slides ? options.slides.map(s => new Slide(s)) : [];
        
        // Arrangements (e.g. "Master", "Radio Edit")
        this.arrangements = options.arrangements || [
            {
                id: 'master',
                name: 'Master',
                sequence: this.slides.map(s => s.id) // Array of Slide IDs in order
            }
        ];
        this.activeArrangementId = options.activeArrangementId || 'master';
    }

    addSlide(options = {}) {
        const slide = new Slide(options);
        this.slides.push(slide);
        
        // Auto-add to Master arrangement
        const master = this.arrangements.find(a => a.id === 'master');
        if (master) {
            master.sequence.push(slide.id);
        }
        
        return slide;
    }

    removeSlide(id) {
        this.slides = this.slides.filter(s => s.id !== id);
        // Remove from all arrangements
        this.arrangements.forEach(arr => {
            arr.sequence = arr.sequence.filter(sId => sId !== id);
        });
    }

    getActiveSlideSequence() {
        const arrangement = this.arrangements.find(a => a.id === this.activeArrangementId) 
                            || this.arrangements.find(a => a.id === 'master');
        
        if (!arrangement) return this.slides;

        return arrangement.sequence.map(id => this.slides.find(s => s.id === id)).filter(Boolean);
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            category: this.category,
            lastModified: new Date().toISOString(),
            themeId: this.themeId,
            transition: this.transition,
            slides: this.slides.map(s => s.toJSON()),
            arrangements: this.arrangements,
            activeArrangementId: this.activeArrangementId
        };
    }
}
