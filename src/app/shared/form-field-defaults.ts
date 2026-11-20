import { Provider } from '@angular/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';

/**
 * Outlined form fields everywhere: lighter than Material's filled default and
 * a better fit for the indigo theme. Provided on the lazily loaded areas
 * (admin, candidate, sign-in) so it isn't part of the first download.
 */
export const OUTLINED_FORM_FIELDS: Provider = {
  provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
  useValue: { appearance: 'outline' },
};
