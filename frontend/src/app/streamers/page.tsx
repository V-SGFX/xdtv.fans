import { permanentRedirect } from 'next/navigation';

/**
 * The streamer directory now lives in Discover.
 *
 * This page was a second, older implementation of the same listing: it
 * filtered its "#" bucket client-side after paginating, so letter counts
 * were wrong, and it was reachable only from two empty states — never from
 * a menu. Discover's directory does the same job with the filtering pushed
 * into SQL.
 *
 * The URL stays as a permanent redirect rather than a delete: it is indexed,
 * carries priority 0.9 in the sitemap, and is listed in the site's JSON-LD
 * sitelinks. A 404 would throw that away for nothing.
 */
export default function StreamersDirectoryPage() {
  permanentRedirect('/discover?tab=streamers');
}
