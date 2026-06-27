/**
 * Testy polityki hasel — utils/password.js
 */
const { enforcePasswordPolicy } = require('../password');

describe('enforcePasswordPolicy()', () => {
  it('rzuca blad gdy wartosc nie jest stringiem', () => {
    expect(() => enforcePasswordPolicy(123)).toThrow('Haslo musi byc tekstem');
    expect(() => enforcePasswordPolicy(null)).toThrow('Haslo musi byc tekstem');
    expect(() => enforcePasswordPolicy(undefined)).toThrow('Haslo musi byc tekstem');
  });

  it('rzuca blad gdy haslo ma mniej niz 10 znakow', () => {
    expect(() => enforcePasswordPolicy('Ab1!')).toThrow('co najmniej 10 znakow');
    expect(() => enforcePasswordPolicy('123456789')).toThrow('co najmniej 10 znakow');
  });

  it('rzuca blad gdy brak malej litery', () => {
    expect(() => enforcePasswordPolicy('ONLYUPPER123!')).toThrow('mala i duza litere');
  });

  it('rzuca blad gdy brak duzej litery', () => {
    expect(() => enforcePasswordPolicy('onlylower123!')).toThrow('mala i duza litere');
  });

  it('rzuca blad gdy brak cyfry', () => {
    expect(() => enforcePasswordPolicy('OnlyLetters!')).toThrow('mala i duza litere');
  });

  it('rzuca blad gdy brak znaku specjalnego', () => {
    expect(() => enforcePasswordPolicy('OnlyLetters123')).toThrow('mala i duza litere');
  });

  it('przyjmuje poprawne haslo', () => {
    expect(() => enforcePasswordPolicy('MojeHaslo123!')).not.toThrow();
    expect(() => enforcePasswordPolicy('Abcdef12345!')).not.toThrow();
    expect(() => enforcePasswordPolicy('P@ssw0rdLong')).not.toThrow();
  });
});