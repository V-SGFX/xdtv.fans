import React, { useEffect, useState } from 'react';
import { Box, H4, Text } from '@adminjs/design-system';

/**
 * Podgląd pliku na karcie rekordu — duży obrazek plus lista użyć.
 *
 * Użycia są tu najważniejsze: bez nich nie wiadomo, czy plik wolno
 * skasować. Sprawdzane są trzy miejsca — okładka materiału, treść
 * materiału i treść wpisu na forum.
 */
const MediaPreview: React.FC<any> = ({ record, property }) => {
  const url: string | undefined = record?.params?.url;
  const base: string = property?.custom?.base ?? '';
  const id = record?.params?.id;

  const [uzycia, setUzycia] = useState<string[] | null>(null);

  /*
   * Użycia bierzemy z routera PANELU, nie z API undernetu.
   *
   * `/api/media/:id/uzycia` po tamtej stronie wymaga tokenu użytkownika
   * undernetu, którego panel nie ma — zapytanie skończyłoby się 401.
   * Tutaj działa sesja administratora, ta sama co dla statystyk.
   */
  useEffect(() => {
    if (!id) return;
    fetch(`/admin/api/undernet-media/${id}/uzycia`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { uzycia: [] }))
      .then((d) => setUzycia(d.uzycia ?? []))
      .catch(() => setUzycia([]));
  }, [id]);

  if (!url) return <Text style={{ color: '#8892A4' }}>Brak pliku.</Text>;
  const pelny = /^https?:\/\//.test(url) ? url : `${base}${url}`;

  return (
    <Box>
      <a href={pelny} target="_blank" rel="noreferrer">
        <img
          src={pelny}
          alt={record?.params?.alt ?? ''}
          style={{
            maxWidth: '100%', maxHeight: 360, objectFit: 'contain',
            borderRadius: 8, border: '1px solid #E4E8EF', background: '#F6F7FB',
          }}
        />
      </a>
      <Text mt="sm" style={{ fontSize: 12, color: '#8892A4', wordBreak: 'break-all' }}>{pelny}</Text>

      <H4 mt="xl" mb="sm">Gdzie jest używany</H4>
      {uzycia === null && <Text style={{ color: '#8892A4' }}>Sprawdzam…</Text>}
      {uzycia?.length === 0 && (
        <Text style={{ color: '#E8A317' }}>
          Nigdzie — ten plik można skasować razem z zawartością.
        </Text>
      )}
      {uzycia?.map((u, i) => (
        <Text key={i} style={{ fontSize: 13, color: '#5C6B84' }}>• {u}</Text>
      ))}
    </Box>
  );
};

export default MediaPreview;
