import { parseCsv, slugify, toCsv } from './csv';

describe('csv', () => {
  describe('toCsv', () => {
    it('writes a header and rows', () => {
      const csv = toCsv(
        [{ a: 'x', b: 1 }],
        [
          { header: 'A', value: (r) => r.a },
          { header: 'B', value: (r) => r.b },
        ],
      );
      expect(csv).toBe('A,B\r\nx,1');
    });

    it('quotes commas, quotes and new lines', () => {
      const csv = toCsv([{ v: 'Chen, "Alex"\nJr' }], [{ header: 'V', value: (r) => r.v }]);
      expect(csv).toBe('V\r\n"Chen, ""Alex""\nJr"');
    });

    it('neutralises spreadsheet formulas', () => {
      const csv = toCsv([{ v: '=SUM(A1)' }], [{ header: 'V', value: (r) => r.v }]);
      expect(csv.split('\r\n')[1]).toBe("'=SUM(A1)");
    });

    it('writes empty cells for null and undefined', () => {
      const csv = toCsv([{}], [{ header: 'V', value: () => null }]);
      expect(csv).toBe('V\r\n');
    });
  });

  describe('parseCsv', () => {
    it('parses quoted fields with commas and escaped quotes', () => {
      expect(parseCsv('name,username\n"Chen, ""Al""",al\n')).toEqual([
        ['name', 'username'],
        ['Chen, "Al"', 'al'],
      ]);
    });

    it('handles CRLF line endings and skips empty lines', () => {
      expect(parseCsv('a,b\r\n\r\n1,2\r\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });

    it('strips a UTF-8 byte-order mark (added by Excel)', () => {
      const withBom = String.fromCharCode(0xfeff) + 'name\nAlex';
      expect(parseCsv(withBom)).toEqual([['name'], ['Alex']]);
    });

    it('keeps an empty last cell', () => {
      expect(parseCsv('a,b\nx,')).toEqual([
        ['a', 'b'],
        ['x', ''],
      ]);
    });

    it('round-trips with toCsv', () => {
      const rows = [{ n: 'O"Neil, Pat' }];
      const csv = toCsv(rows, [{ header: 'n', value: (r) => r.n }]);
      expect(parseCsv(csv)).toEqual([['n'], ['O"Neil, Pat']]);
    });
  });

  it('slugifies titles for file names', () => {
    expect(slugify('JS Basics: Part 1!')).toBe('js-basics-part-1');
    expect(slugify('!!!')).toBe('export');
  });
});
