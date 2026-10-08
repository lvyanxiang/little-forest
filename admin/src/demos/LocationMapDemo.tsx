/**
 * 地图接入参考：目前不在管理后台正式流程中使用。
 * 若以后恢复可视化选点，可将此组件引入 StorePage，并把 onPick 的结果保存为经纬度。
 */
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

type Props = {
  latitude: number
  longitude: number
  onPick: (latitude: number, longitude: number) => void
}

export function LocationMapDemo({ latitude, longitude, onPick }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  useEffect(() => {
    if (!boxRef.current || mapRef.current) return
    const lat = latitude || 31.22048
    const lng = longitude || 121.42516
    const map = L.map(boxRef.current).setView([lat, lng], 16)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)
    const marker = L.marker([lat, lng], { draggable: true }).addTo(map)
    const emit = (nextLat: number, nextLng: number) => {
      onPickRef.current(Number(nextLat.toFixed(6)), Number(nextLng.toFixed(6)))
    }
    marker.on('dragend', () => {
      const position = marker.getLatLng()
      emit(position.lat, position.lng)
    })
    map.on('click', (event) => emit(event.latlng.lat, event.latlng.lng))
    mapRef.current = map
    markerRef.current = marker
    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !latitude || !longitude) return
    const current = markerRef.current.getLatLng()
    if (Math.abs(current.lat - latitude) < 0.000001 && Math.abs(current.lng - longitude) < 0.000001) return
    const next = L.latLng(latitude, longitude)
    markerRef.current.setLatLng(next)
    mapRef.current.setView(next, mapRef.current.getZoom())
  }, [latitude, longitude])

  return <div ref={boxRef} className="h-64 w-full md:h-80" />
}
