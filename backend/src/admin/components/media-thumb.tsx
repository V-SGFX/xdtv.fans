import React from 'react';
import { Box, Text } from '@adminjs/design-system';

/**
 * Miniatura pliku na liście mediów.
 *
 * Bez niej „przegląd mediów" był tabelą nazw plików w rodzaju
 * `e1493c5ba8ca8d57d3905f5c.webp` — nazwy są losowe z rozmysłem (adres
 * nigdy się nie powtarza), więc z samej listy nie dało się poznać ANI
 * JEDNEGO obrazka.
 *
 * Adres MUSI być bezwzględny. Panel otwiera się spod dwóch domen, a pliki
 * undernetu leżą tylko pod jedną — ścieżka względna trafiłaby przy
 * xdtv.fans w katalog uploadów xdtv i pokazała cudzy obrazek albo nic.
 * Bazę podaje `property.custom.base`.
 */
const MediaThumb: React.FC<any> = ({ record, property }) => {
  const url: string | undefined = record?.params?.[property?.name ?? 'url'];
  const alt: string = record?.params?.alt ?? '';
  const base: string = property?.custom?.base ?? '';

  if (!url) return <Text style={{ color: '#8892A4' }}>—</Text>;

  const pelny = /^https?:\/\//.test(url) ? url : `${base}${url}`;

  return (
    <Box flex alignItems="center" style={{ gap: 10 }}>
      <a href={pelny} target="_blank" rel="noreferrer" style={{ lineHeight: 0 }}>
        <img
          src={pelny}
          alt={alt}
          loading="lazy"
          style={{
            width: 72, height: 48, objectFit: 'cover',
            borderRadius: 6, border: '1px solid #E4E8EF', background: '#F6F7FB',
          }}
          onError={(e) => {
            const el = e.currentTarget;
            el.style.display = 'none';
            el.insertAdjacentHTML(
              'afterend',
              '<span style="font-size:11px;color:#D9456B">plik nie istnieje</span>',
            );
          }}
        />
      </a>
      <Text style={{ fontSize: 11, color: alt ? '#5C6B84' : '#D9456B' }}>
        {alt || 'brak opisu alternatywnego'}
      </Text>
    </Box>
  );
};

export default MediaThumb;
