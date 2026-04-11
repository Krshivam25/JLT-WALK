import Toast from 'react-native-toast-message';

export function showSuccess(title: string, message?: string) {
  Toast.show({ type: 'success', text1: title, text2: message, position: 'top', visibilityTime: 3000 });
}

export function showError(title: string, message?: string) {
  Toast.show({ type: 'error', text1: title, text2: message, position: 'top', visibilityTime: 4000 });
}

export function showInfo(title: string, message?: string) {
  Toast.show({ type: 'info', text1: title, text2: message, position: 'top', visibilityTime: 3000 });
}

export function showApiError(err: any, fallback = 'Something went wrong') {
  const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
  showError('Error', msg);
}
