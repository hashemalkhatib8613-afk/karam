-- Album display controls: replace the horizontal filmstrip with side-by-side
-- layouts, and let the CMS choose the media aspect ratio independently.

alter table public.albums
  add column if not exists media_aspect text not null default 'square';

alter table public.albums drop constraint if exists albums_layout_type_check;

update public.albums set layout_type = 'grid-2' where layout_type = 'filmstrip';
update public.albums set layout_type = 'grid-3' where layout_type = 'grid';

alter table public.albums
  add constraint albums_layout_type_check
  check (layout_type in ('grid-2', 'grid-3', 'masonry', 'polaroid', 'collage'));

alter table public.albums alter column layout_type set default 'grid-2';

alter table public.albums drop constraint if exists albums_media_aspect_check;
alter table public.albums
  add constraint albums_media_aspect_check
  check (media_aspect in ('natural', 'square', 'landscape', 'wide', 'portrait'));

comment on column public.albums.layout_type is
  'CMS-selected side-by-side presentation for album media.';
comment on column public.albums.media_aspect is
  'CMS-selected visible media dimensions; does not modify uploaded files.';
