import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ResultsTableComponent } from '../results/results-table.component';

/** /admin/results: submissions across all exams. ?status=needs-grading pre-filters. */
@Component({
  selector: 'app-results-page',
  imports: [MatCardModule, ResultsTableComponent],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Results</h1>
          <p>Submissions from every exam. Grade Input answers and export scores.</p>
        </div>
      </header>
      <mat-card appearance="outlined">
        <app-results-table
          [initialStatus]="status() === 'needs-grading' ? 'needs-grading' : 'all'"
        />
      </mat-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsPageComponent {
  /** ?status= query param. */
  readonly status = input<string>();
}
