import moment from 'moment';

export const formatScheduledDateLabel = (date, now = new Date()) => {
  const m = moment(date);
  const today = moment(now).startOf('day');
  const tomorrow = moment(now).add(1, 'day').startOf('day');
  const day = m.clone().startOf('day');

  if (day.isSame(today, 'day')) {
    return 'Today';
  }
  if (day.isSame(tomorrow, 'day')) {
    return 'Tomorrow';
  }
  return m.format('MMM D, YYYY');
};

export const formatScheduledTimeLabel = date => moment(date).format('h:mm A');

export const shortenAddress = (address, maxLen = 40) => {
  if (!address) {
    return '';
  }
  if (address.length <= maxLen) {
    return address;
  }
  const parts = address.split(',');
  if (parts.length >= 2) {
    return `${parts[0].trim()}, ${parts[1].trim()}`;
  }
  return address.slice(0, maxLen - 1) + '…';
};
