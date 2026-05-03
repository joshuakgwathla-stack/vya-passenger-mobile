import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'vya_saved_home_address'

export const getSavedAddress = (): Promise<string | null> =>
  AsyncStorage.getItem(KEY)

export const setSavedAddress = (addr: string): Promise<void> =>
  AsyncStorage.setItem(KEY, addr)

export const clearSavedAddress = (): Promise<void> =>
  AsyncStorage.removeItem(KEY)
