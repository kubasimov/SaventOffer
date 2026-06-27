function enforcePasswordPolicy(value) {
  if (typeof value !== 'string') {
    throw new Error('Haslo musi byc tekstem');
  }
  if (value.length < 10) {
    throw new Error('Haslo musi miec co najmniej 10 znakow');
  }
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{10,}$/.test(value)) {
    throw new Error('Haslo musi zawierac mala i duza litere, cyfre oraz znak specjalny');
  }
}
                                                                                             
module.exports = { enforcePasswordPolicy };                                                  