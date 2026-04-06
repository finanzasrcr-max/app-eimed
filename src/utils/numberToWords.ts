/**
 * Convierte un número en su representación en letras (Español)
 * Adaptado para moneda (Dólares)
 */
export function numberToWords(num: number): string {
  if (num === 0) return 'CERO DÓLARES CON 00/100';

  const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const tens = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function convertGroup(n: number): string {
    let output = '';
    if (n === 100) return 'CIEN ';
    if (n >= 100) {
      output += hundreds[Math.floor(n / 100)] + ' ';
      n %= 100;
    }
    if (n >= 20) {
      output += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' Y ' : ' ');
      n %= 10;
    } else if (n >= 10) {
      output += teens[n - 10] + ' ';
      n = 0;
    }
    if (n > 0) {
      output += units[n] + ' ';
    }
    return output;
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let result = '';
  if (integerPart >= 1000) {
    const thousands = Math.floor(integerPart / 1000);
    result += (thousands === 1 ? '' : convertGroup(thousands)) + 'MIL ';
    result += convertGroup(integerPart % 1000);
  } else {
    result += convertGroup(integerPart);
  }

  const cents = decimalPart.toString().padStart(2, '0');
  
  if (integerPart === 1) {
    return `${result.trim()} DÓLAR CON ${cents}/100`;
  }
  
  return `${result.trim()} DÓLARES CON ${cents}/100`;
}
