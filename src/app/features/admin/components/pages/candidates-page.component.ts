import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { CandidatesTableComponent } from '../candidates/candidates-table.component';

/** /admin/candidates: every candidate across all exams. */
@Component({
  selector: 'app-candidates-page',
  imports: [MatCardModule, CandidatesTableComponent],
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Candidates</h1>
          <p>
            Everyone who can log in to an exam. To add candidates, open an exam's Candidates tab.
          </p>
        </div>
      </header>
      <mat-card appearance="outlined">
        <app-candidates-table />
      </mat-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CandidatesPageComponent {}
