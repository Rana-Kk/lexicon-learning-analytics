import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'node:zlib';

import { parseXlsx } from '../../src/utils/xlsx.js';

// =====================================================
// TEST HELPERS
// Minimal ZIP/XLSX generator
// =====================================================

function createZip(entries) {
  const localParts = [];
  const centralParts = [];

  let offset = 0;

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const dataBuffer = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(entry.data, 'utf8');

    const compressed =
      entry.method === 0
        ? dataBuffer
        : deflateRawSync(dataBuffer);

    const method = entry.method ?? 8;

    // -----------------------------
    // Local file header
    // -----------------------------
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(
      localHeader,
      nameBuffer,
      compressed
    );

    // -----------------------------
    // Central directory
    // -----------------------------
    const centralHeader = Buffer.alloc(46);

    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(
      centralHeader,
      nameBuffer
    );

    offset +=
      localHeader.length +
      nameBuffer.length +
      compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localData = Buffer.concat(localParts);

  // -----------------------------
  // End Of Central Directory
  // -----------------------------
  const eocd = Buffer.alloc(22);

  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(localData.length, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([
    localData,
    centralDirectory,
    eocd
  ]);
}

function createXlsx({
  sheetXml,
  sharedStringsXml = null,
  compression = true
}) {
  const entries = [];

  if (sharedStringsXml) {
    entries.push({
      name: 'xl/sharedStrings.xml',
      data: sharedStringsXml,
      method: compression ? 8 : 0
    });
  }

  entries.push({
    name: 'xl/worksheets/sheet1.xml',
    data: sheetXml,
    method: compression ? 8 : 0
  });

  return createZip(entries);
}

// =====================================================
// TESTS
// =====================================================

describe('xlsx.js - parseXlsx', () => {

  // ===================================================
  // BASIC PARSING
  // ===================================================

  describe('basic XLSX parsing', () => {

    it('should parse a simple worksheet', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row r="1">
              <c r="A1" t="inlineStr">
                <is><t>Name</t></is>
              </c>

              <c r="B1" t="inlineStr">
                <is><t>Email</t></is>
              </c>
            </row>

            <row r="2">
              <c r="A2" t="inlineStr">
                <is><t>John</t></is>
              </c>

              <c r="B2" t="inlineStr">
                <is><t>john@test.com</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const buffer = createXlsx({
        sheetXml
      });

      const result = parseXlsx(buffer);

      expect(result).toEqual([
        {
          name: 'John',
          email: 'john@test.com'
        }
      ]);
    });

  });


  // ===================================================
  // HEADER NORMALIZATION
  // ===================================================

  describe('header normalization', () => {

    it('should convert headers to lowercase', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>NAME</t></is>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is><t>John</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        {
          name: 'John'
        }
      ]);
    });


    it('should replace spaces with underscores', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>GitHub Username</t></is>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is><t>john123</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        {
          github_username: 'john123'
        }
      ]);
    });


    it('should trim header whitespace', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>  Email  </t></is>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is><t>test@test.com</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        {
          email: 'test@test.com'
        }
      ]);
    });

  });


  // ===================================================
  // SHARED STRINGS
  // ===================================================

  describe('shared strings', () => {

    it('should parse shared strings correctly', () => {

      const sharedStringsXml = `
        <sst>

          <si>
            <t>Name</t>
          </si>

          <si>
            <t>Email</t>
          </si>

          <si>
            <t>John</t>
          </si>

          <si>
            <t>john@test.com</t>
          </si>

        </sst>
      `;

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>

              <c r="A1" t="s">
                <v>0</v>
              </c>

              <c r="B1" t="s">
                <v>1</v>
              </c>

            </row>

            <row>

              <c r="A2" t="s">
                <v>2</v>
              </c>

              <c r="B2" t="s">
                <v>3</v>
              </c>

            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({
          sheetXml,
          sharedStringsXml
        })
      );

      expect(result).toEqual([
        {
          name: 'John',
          email: 'john@test.com'
        }
      ]);
    });


    it('should handle missing shared string index safely', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="s">
                <v>99</v>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is><t>John</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({
          sheetXml
        })
      );

      expect(result).toEqual([
        {
          '': 'John'
        }
      ]);
    });

  });


  // ===================================================
  // MULTIPLE ROWS
  // ===================================================

  describe('multiple rows', () => {

    it('should parse multiple data rows', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>Name</t></is>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is><t>John</t></is>
              </c>
            </row>

            <row>
              <c r="A3" t="inlineStr">
                <is><t>Jane</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        { name: 'John' },
        { name: 'Jane' }
      ]);
    });

  });


  // ===================================================
  // EMPTY ROWS
  // ===================================================

  describe('empty rows', () => {

    it('should filter completely empty rows', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>Name</t></is>
              </c>
            </row>

            <row>
            </row>

            <row>
              <c r="A3" t="inlineStr">
                <is><t>John</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        {
          name: 'John'
        }
      ]);
    });


    it('should filter rows containing only whitespace', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>Name</t></is>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is><t>    </t></is>
              </c>
            </row>

            <row>
              <c r="A3" t="inlineStr">
                <is><t>John</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        {
          name: 'John'
        }
      ]);
    });

  });


  // ===================================================
  // EMPTY CELLS
  // ===================================================

  describe('empty cells', () => {

    it('should fill missing cells with empty strings', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>

              <c r="A1" t="inlineStr">
                <is><t>Name</t></is>
              </c>

              <c r="B1" t="inlineStr">
                <is><t>Email</t></is>
              </c>

            </row>

            <row>

              <c r="A2" t="inlineStr">
                <is><t>John</t></is>
              </c>

            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        {
          name: 'John',
          email: ''
        }
      ]);
    });


    it('should handle skipped columns', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>

              <c r="A1" t="inlineStr">
                <is><t>Name</t></is>
              </c>

              <c r="B1" t="inlineStr">
                <is><t>Email</t></is>
              </c>

              <c r="C1" t="inlineStr">
                <is><t>Role</t></is>
              </c>

            </row>

            <row>

              <c r="A2" t="inlineStr">
                <is><t>John</t></is>
              </c>

              <c r="C2" t="inlineStr">
                <is><t>student</t></is>
              </c>

            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        {
          name: 'John',
          email: '',
          role: 'student'
        }
      ]);
    });

  });


  // ===================================================
  // XML ESCAPING
  // ===================================================

  describe('XML entities', () => {

    it('should unescape XML characters', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>Description</t></is>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is>
                  <t>Tom &amp; Jerry &lt;Test&gt;</t>
                </is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        {
          description: 'Tom & Jerry <Test>'
        }
      ]);
    });

  });


  // ===================================================
  // NUMERIC VALUES
  // ===================================================

  describe('numeric values', () => {

    it('should parse normal numeric cell values', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>

              <c r="A1" t="inlineStr">
                <is><t>ID</t></is>
              </c>

              <c r="B1" t="inlineStr">
                <is><t>Score</t></is>
              </c>

            </row>

            <row>

              <c r="A2">
                <v>123</v>
              </c>

              <c r="B2">
                <v>95</v>
              </c>

            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([
        {
          id: '123',
          score: '95'
        }
      ]);
    });

  });


  // ===================================================
  // BUFFER INPUT
  // ===================================================

  describe('input handling', () => {

    it('should accept Uint8Array input', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>Name</t></is>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is><t>John</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const buffer = createXlsx({ sheetXml });

      const uint8 = new Uint8Array(buffer);

      const result = parseXlsx(uint8);

      expect(result).toEqual([
        {
          name: 'John'
        }
      ]);
    });

  });


  // ===================================================
  // COMPRESSION
  // ===================================================

  describe('ZIP compression', () => {

    it('should parse compressed XLSX entries', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>Name</t></is>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is><t>Compressed</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({
          sheetXml,
          compression: true
        })
      );

      expect(result).toEqual([
        {
          name: 'Compressed'
        }
      ]);
    });


    it('should parse uncompressed XLSX entries', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>

            <row>
              <c r="A1" t="inlineStr">
                <is><t>Name</t></is>
              </c>
            </row>

            <row>
              <c r="A2" t="inlineStr">
                <is><t>Uncompressed</t></is>
              </c>
            </row>

          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({
          sheetXml,
          compression: false
        })
      );

      expect(result).toEqual([
        {
          name: 'Uncompressed'
        }
      ]);
    });

  });


  // ===================================================
  // EMPTY WORKSHEET
  // ===================================================

  describe('empty worksheet', () => {

    it('should return empty array when there are no rows', () => {

      const sheetXml = `
        <worksheet>
          <sheetData>
          </sheetData>
        </worksheet>
      `;

      const result = parseXlsx(
        createXlsx({ sheetXml })
      );

      expect(result).toEqual([]);
    });

  });


  // ===================================================
  // ERROR CASES
  // ===================================================

  describe('error handling', () => {

    it('should throw error for invalid XLSX/ZIP buffer', () => {

      const invalidBuffer = Buffer.from(
        'this is not an xlsx file'
      );

      expect(() => {
        parseXlsx(invalidBuffer);
      }).toThrow('Invalid XLSX/ZIP file');

    });


    it('should throw error when worksheet does not exist', () => {

      const buffer = createZip([
        {
          name: 'xl/sharedStrings.xml',
          data: '<sst></sst>',
          method: 8
        }
      ]);

      expect(() => {
        parseXlsx(buffer);
      }).toThrow('No worksheet found in XLSX file');

    });


    it('should throw error for invalid ZIP central directory', () => {

      const invalid = Buffer.alloc(100);

      invalid.writeUInt32LE(
        0x06054b50,
        78
      );

      invalid.writeUInt16LE(1, 88);
      invalid.writeUInt32LE(10, 90);
      invalid.writeUInt32LE(0, 94);

      expect(() => {
        parseXlsx(invalid);
      }).toThrow();

    });

  });

});