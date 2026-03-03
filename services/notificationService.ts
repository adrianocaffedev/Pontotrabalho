
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('Este navegador não suporta notificações desktop');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

export const sendNotification = (title: string, options?: NotificationOptions) => {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  const defaultOptions: NotificationOptions = {
    icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' rx=\'24\' fill=\'%234f46e5\'/%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'35\' fill=\'none\' stroke=\'white\' stroke-width=\'6\'/%3E%3Cpath d=\'M50 25 v25 h20\' fill=\'none\' stroke=\'white\' stroke-width=\'6\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E',
    badge: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Crect width=\'100\' height=\'100\' rx=\'24\' fill=\'%234f46e5\'/%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'35\' fill=\'none\' stroke=\'white\' stroke-width=\'6\'/%3E%3Cpath d=\'M50 25 v25 h20\' fill=\'none\' stroke=\'white\' stroke-width=\'6\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E',
    ...options
  };

  return new Notification(title, defaultOptions);
};
