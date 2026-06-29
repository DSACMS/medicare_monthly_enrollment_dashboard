export const monthOrder = {
  'January': 1,
  'February': 2,
  'March': 3,
  'April': 4,
  'May': 5,
  'June': 6,
  'July': 7,
  'August': 8,
  'September': 9,
  'October': 10,
  'November': 11,
  'December': 12
};

export const getPercent = (count, totalVal) => 
  totalVal > 0 ? parseFloat(((count / totalVal) * 100).toFixed(2)) : 0;

