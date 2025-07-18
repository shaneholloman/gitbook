import { notFound, redirect } from 'next/navigation';
import { ImageResponse } from 'next/og';

import type { GitBookSiteContext } from '@/lib/context';
import { getEmojiForCode } from '@/lib/emojis';
import { getResizedImageURL } from '@/lib/images';
import { tcls } from '@/lib/tailwind';
import { getCacheTag } from '@gitbook/cache-tags';

const SIZES = {
    /** Size for a favicon */
    small: {
        width: 48,
        height: 48,
        textSize: 'text-[32px]',
        boxStyle: 'rounded-[8px]',
    },
    /** Size for display as an app icon or in the header */
    medium: {
        width: 256,
        height: 256,
        textSize: 'text-[164px]',
        boxStyle: 'rounded-[32px]',
    },
};

type RenderIconOptions = {
    size: keyof typeof SIZES;
    theme: 'light' | 'dark';
};

/**
 * Generate an icon for a site content.
 */
export async function serveIcon(context: GitBookSiteContext, req: Request) {
    const options = getOptions(req.url);
    const size = SIZES[options.size];

    const { customization } = context;
    const customIcon = 'icon' in customization.favicon ? customization.favicon.icon : null;

    // If the site has a custom icon, redirect to it
    if (customIcon) {
        const iconUrl = options.theme === 'light' ? customIcon.light : customIcon.dark;
        redirect(
            await getResizedImageURL(context.imageResizer, iconUrl, {
                width: size.width,
                height: size.height,
            })
        );
    }

    return new ImageResponse(<SiteDefaultIcon context={context} options={options} />, {
        width: size.width,
        height: size.height,
        headers: {
            'cache-tag': [
                getCacheTag({
                    tag: 'site',
                    site: context.site.id,
                }),
            ].join(','),
        },
    });
}

/**
 * Render the icon as a React node.
 */
export function SiteDefaultIcon(props: {
    context: GitBookSiteContext;
    options: RenderIconOptions;
    style?: React.CSSProperties;
    tw?: string;
}) {
    const { context, options, style, tw } = props;
    const size = SIZES[options.size];

    const { site, customization } = context;
    const contentTitle = site.title;

    return (
        <div
            tw={tcls(options.theme === 'light' ? 'bg-white' : 'bg-black', size.boxStyle, tw)}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                ...style,
            }}
        >
            <h2
                tw={tcls(
                    size.textSize,
                    'font-bold',
                    'tracking-tight',
                    options.theme === 'light' ? 'text-black' : 'text-white'
                )}
            >
                {'emoji' in customization.favicon
                    ? getEmojiForCode(customization.favicon.emoji)
                    : contentTitle.slice(0, 1).toUpperCase()}
            </h2>
        </div>
    );
}

function getOptions(inputUrl: string): {
    size: keyof typeof SIZES;
    theme: 'light' | 'dark';
} {
    const url = new URL(inputUrl);
    const sizeParam = (url.searchParams.get('size') ?? 'small') as keyof typeof SIZES;
    const themeParam = url.searchParams.get('theme') ?? 'light';

    if (!SIZES[sizeParam] || !['light', 'dark'].includes(themeParam)) {
        notFound();
    }

    return {
        // @ts-ignore
        size: sizeParam,
        // @ts-ignore
        theme: themeParam,
    };
}
