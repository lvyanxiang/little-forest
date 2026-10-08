import { request } from './request'
import { resolveApiAsset } from './config'

export interface StoreInfo {
  name: string
  address: string
  latitude: number
  longitude: number
  phone: string
  phoneDisplay: string
  hours: string
  closedWeekdays: number[]
  noticeHeading: string
  noticeItems: string[]
  noticeFoot: string
  homeNoticeText: string
  homeHeroText: string
  homeHeroImageUrl: string
  successNoticeLines: string[]
}

export const FALLBACK_STORE: StoreInfo = {
  name: '小森林书店',
  address: '上海市长宁区延安西路1221号泛太大厦2号楼1层底商',
  latitude: 31.22048,
  longitude: 121.42516,
  phone: '18017251036',
  phoneDisplay: '180-1725-1036',
  hours: '周二至周日 14:00 – 21:00（周一闭馆）',
  closedWeekdays: [1],
  noticeHeading: '小森林庇护所注意事项',
  noticeItems: [
    '我们是自助无人值守空间，不是绝对安静的自习室，不习惯有白噪音的客人请慎入。',
    '空间内难免有讨论、走动、音乐播放、键盘敲击等声音，无法做到图书馆一样的安静，请务必慎入。',
    '阅读完的书请放回书架。',
    '椅子多是欧洲中古家具或设计师家具，请务必爱护。',
    '离开时请关掉台灯，垃圾请丢到水台旁红色大垃圾桶。',
    '水杯可放在水池内，志愿者会定时清洗消毒。',
    '纯净水（冰、热）在水台旁，可自取。',
    'Wi-Fi 名称：377film　密码：xiaosenlinlin',
    '意见或建议请到小红书私信「小森林」，我们会及时回复。',
  ],
  noticeFoot: '请和我们一样，爱护爱惜这个空间。谢谢。',
  homeNoticeText:
    '自助无人值守，不是绝对安静的自习室，店内可能有交谈、音乐与走动，请先确认是否适合，书看完请放回书架，离开时关台灯、垃圾入桶',
  homeHeroText: '讀著書\n一輩子很快就過去了\n去讀書吧\n讀一句\n便經歷一句',
  homeHeroImageUrl: '',
  successNoticeLines: [
    'Wi-Fi：377film　密码 xiaosenlinlin',
    '书看完请放回书架，离开时关掉台灯',
    '垃圾请丢到水台旁红色大垃圾桶',
  ],
}

let cached: StoreInfo | null = null

export function getStore() {
  return cached || FALLBACK_STORE
}

export async function fetchStore() {
  const store = await request<StoreInfo>('/store')
  store.homeHeroImageUrl = resolveApiAsset(store.homeHeroImageUrl)
  cached = store
  return store
}

export function openStoreMap(store = getStore()) {
  wx.openLocation({
    latitude: store.latitude,
    longitude: store.longitude,
    name: store.name,
    address: store.address,
    scale: 16,
  })
}
