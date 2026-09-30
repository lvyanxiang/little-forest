export const STORE = {
  name: '小森林书店',
  address: '上海市长宁区延安西路1221号泛太大厦2号楼1层底商',
  latitude: 31.22048,
  longitude: 121.42516,
  phone: '18017251036',
  phoneDisplay: '180-1725-1036',
  hours: '周二至周日 14:00 – 21:00（周一闭馆）',
}

export function openStoreMap() {
  wx.openLocation({
    latitude: STORE.latitude,
    longitude: STORE.longitude,
    name: STORE.name,
    address: STORE.address,
    scale: 16,
  })
}
