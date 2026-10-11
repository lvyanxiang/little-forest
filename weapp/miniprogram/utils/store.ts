import { request } from './request'
import { resolveApiAsset } from './config'

export interface StoreInfo {
  address: string
  closedWeekdays: number[]
  noticeHeading: string
  noticeItems: string[]
  noticeFoot: string
  homeHeroText: string
  homeHeroImageUrl: string
  successNoticeLines: string[]
}

export const FALLBACK_STORE: StoreInfo = {
  address: '上海市长宁区延安西路1221号泛太大厦2号楼1层底商',
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
