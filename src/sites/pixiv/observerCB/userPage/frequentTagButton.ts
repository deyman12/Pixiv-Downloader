import { ArtworkTagButton, type TagProps } from '@/lib/components/Pixiv/artworkTagButton';

export function createFrequentTagBtn(
  downloading: ReactiveValue<boolean>,
  handleDownload: (props: TagProps) => Promise<void>
) {
  const tagsEles = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[status]'));
  if (!tagsEles.length) return;

  tagsEles.forEach((ele) => {
    if (ele.nextElementSibling?.tagName.toLowerCase() === ArtworkTagButton.tagNameLowerCase) return;

    const artworkTagBtn = new ArtworkTagButton(ele, downloading, handleDownload);
    ele.parentElement!.appendChild(artworkTagBtn);
  });
}
