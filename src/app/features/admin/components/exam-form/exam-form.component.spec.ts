import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExamFormComponent, ExamFormValue } from './exam-form.component';
import { Exam } from '../../../../shared/models/exam.model';

describe('ExamFormComponent', () => {
  let fixture: ComponentFixture<ExamFormComponent>;
  let el: HTMLElement;

  const input = (name: string) =>
    el.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[formcontrolname="${name}"]`)!;

  const type = (name: string, value: string) => {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ExamFormComponent] }).compileComponents();
    fixture = TestBed.createComponent(ExamFormComponent);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('does not submit and shows an error when the title is empty', async () => {
    const emitted: ExamFormValue[] = [];
    fixture.componentInstance.submitted.subscribe((v) => emitted.push(v));

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual([]);
    expect(el.textContent).toContain('Title is required.');
  });

  it('emits trimmed values, with an empty description as null', async () => {
    const emitted: ExamFormValue[] = [];
    fixture.componentInstance.submitted.subscribe((v) => emitted.push(v));

    type('title', '  JS Basics  ');
    type('description', '   ');
    type('duration_minutes', '45');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    expect(emitted).toEqual([{ title: 'JS Basics', description: null, duration_minutes: 45 }]);
  });

  it('fills the form from the exam input (edit mode)', async () => {
    const exam: Exam = {
      id: 'e1',
      title: 'Sample',
      description: 'For testing',
      duration_minutes: 90,
      is_published: true,
      created_at: '2026-01-01',
    };
    fixture.componentRef.setInput('exam', exam);
    await fixture.whenStable();

    expect(input('title').value).toBe('Sample');
    expect(input('description').value).toBe('For testing');
    expect(input('duration_minutes').value).toBe('90');
  });

  it('rejects a duration over 600 minutes', async () => {
    const emitted: ExamFormValue[] = [];
    fixture.componentInstance.submitted.subscribe((v) => emitted.push(v));

    type('title', 'Long exam');
    type('duration_minutes', '601');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual([]);
    expect(el.textContent).toContain('at most 600 minutes');
  });
});
