import { describe, it, expect } from 'vitest';
import { Presentation } from './Presentation';
import { Slide } from './Slide';

describe('Presentation Model', () => {
  it('should create a presentation and allow adding slides', () => {
    const presentation = new Presentation({ id: '123', name: 'Test Pres' });
    expect(presentation.id).toBe('123');
    expect(presentation.name).toBe('Test Pres');
    expect(presentation.slides.length).toBe(0);

    const slide = new Slide({ id: 's1' });
    presentation.addSlide(slide);
    expect(presentation.slides.length).toBe(1);
    expect(presentation.slides[0].id).toBe('s1');
  });

  it('should format data correctly for serialization', () => {
    const presentation = new Presentation({ id: '123', name: 'Test Pres' });
    const json = presentation.toJSON();
    expect(json.name).toBe('Test Pres');
    expect(json.id).toBe('123');
  });
});
