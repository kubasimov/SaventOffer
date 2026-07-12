import { useState } from 'react'

export function AkordeonItem({ label, aktywny, kropka, ikona, onClick, licznik }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 14px', cursor: 'pointer', fontSize: 13, borderRadius: 6, margin: '2px 6px',
        display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
        color: aktywny ? '#fff' : '#888', fontWeight: aktywny ? 600 : 400,
        background: aktywny ? '#5f2f4d' : 'transparent',
      }}
      onMouseEnter={e => { if (!aktywny) e.currentTarget.style.background = '#333' }}
      onMouseLeave={e => { if (!aktywny) e.currentTarget.style.background = 'transparent' }}
    >
      {kropka && <span style={{ width: 8, height: 8, borderRadius: '50%', display: 'inline-block', background: kropka, flexShrink: 0 }} />}
      {ikona && <span style={{ flexShrink: 0 }}>{ikona}</span>}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {licznik !== undefined && (
        <span style={{ fontSize: 11, color: aktywny ? 'rgba(255,255,255,0.7)' : '#666', background: aktywny ? 'rgba(255,255,255,0.15)' : '#2b2b2b', padding: '1px 7px', borderRadius: 10 }}>{licznik}</span>
      )}
    </div>
  )
}

export default function SidebarAkordeon({ title, icon, domyslnieOtwarty, children, style }) {
  const [otwarty, setOtwarty] = useState(domyslnieOtwarty !== false)

  return (
    <div style={{ borderBottom: '1px solid #3a3a3a', ...style }}>
      <div
        onClick={() => setOtwarty(!otwarty)}
        style={{
          padding: '11px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
          color: '#c6bec4', fontWeight: 600, fontSize: 13, letterSpacing: 0.3,
          userSelect: 'none', transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#333'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
        <span style={{ flex: 1, textTransform: 'uppercase' }}>{title}</span>
        <span style={{
          fontSize: 11, color: '#666', transition: 'transform 0.2s',
          transform: otwarty ? 'rotate(180deg)' : 'rotate(0deg)'
        }}>▼</span>
      </div>
      <div style={{
        overflow: 'hidden', transition: 'max-height 0.25s ease, opacity 0.2s',
        maxHeight: otwarty ? '600px' : '0', opacity: otwarty ? 1 : 0,
        padding: otwarty ? '4px 0 6px' : '0',
      }}>
        {children}
      </div>
    </div>
  )
}