import { CustomizationDefaultFont, CustomizationHeaderPreset } from '@gitbook/api';
import { colorContrast } from '@gitbook/colors';
import { type FontWeight, getDefaultFont } from '@gitbook/fonts';
import { redirect } from 'next/navigation';
import { ImageResponse } from 'next/og';

import { type PageParams, fetchPageData } from '@/components/SitePage';
import { getFontSourcesToPreload } from '@/fonts/custom';
import { getAssetURL } from '@/lib/assets';
import { filterOutNullable } from '@/lib/typescript';
import { getCacheTag } from '@gitbook/cache-tags';
import type { GitBookSiteContext } from '@v2/lib/context';
import { getResizedImageURL } from '@v2/lib/images';

/**
 * Render the OpenGraph image for a site content.
 */
export async function serveOGImage(baseContext: GitBookSiteContext, params: PageParams) {
    const { context, pageTarget } = await fetchPageData(baseContext, params);
    const { customization, site, linker, imageResizer } = context;
    const page = pageTarget?.page;

    // If user configured a custom social preview, we redirect to it.
    if (customization.socialPreview.url) {
        redirect(
            await getResizedImageURL(imageResizer, customization.socialPreview.url, {
                width: 1200,
                height: 630,
            })
        );
    }

    // Compute all text to load only the necessary fonts
    const contentTitle = customization.header.logo ? '' : site.title;
    const pageTitle = page
        ? page.title.length > 64
            ? `${page.title.slice(0, 64)}...`
            : page.title
        : 'Not found';
    const pageDescription =
        page?.description && page?.title.length <= 64
            ? page.description.length > 164
                ? `${page.description.slice(0, 164)}...`
                : page.description
            : '';

    // Load the fonts
    const { fontFamily, fonts } = await (async () => {
        // google fonts
        if (typeof customization.styling.font === 'string') {
            const fontFamily = customization.styling.font ?? CustomizationDefaultFont.Inter;

            const regularText = pageDescription;
            const boldText = `${contentTitle}${pageTitle}`;

            const fonts = (
                await Promise.all([
                    loadGoogleFont({ font: fontFamily, text: regularText, weight: 400 }),
                    loadGoogleFont({ font: fontFamily, text: boldText, weight: 700 }),
                ])
            ).filter(filterOutNullable);

            return { fontFamily, fonts };
        }

        // custom fonts
        // We only load the primary font weights for now
        const primaryFontWeights = getFontSourcesToPreload(customization.styling.font);

        const fonts = (
            await Promise.all(
                primaryFontWeights.map((face) => {
                    const { weight, sources } = face;
                    const source = sources[0];

                    // Satori doesn't support WOFF2, so we skip it
                    // https://github.com/vercel/satori?tab=readme-ov-file#fonts
                    if (!source || source.format === 'woff2' || source.url.endsWith('.woff2')) {
                        return null;
                    }

                    return loadCustomFont({ url: source.url, weight });
                })
            )
        ).filter(filterOutNullable);

        return { fontFamily: 'CustomFont', fonts };
    })();

    const theme = customization.themes.default;
    const useLightTheme = theme === 'light';

    // We have no access to CSS variables, so we'll have to hardcode some values
    const baseColors = { light: '#ffffff', dark: '#111827' };

    let colors = {
        background: baseColors[theme],
        gradient: customization.styling.primaryColor[theme],
        title: customization.styling.primaryColor[theme],
        body: baseColors[useLightTheme ? 'dark' : 'light'], // Invert text on background
    };

    const gridWhite = getAssetURL('images/ogimage-grid-white.png');
    const gridBlack = getAssetURL('images/ogimage-grid-black.png');

    let gridAsset = useLightTheme ? gridBlack : gridWhite;

    switch (customization.header.preset) {
        case CustomizationHeaderPreset.Custom:
            colors = {
                background: customization.header.backgroundColor?.[theme] || colors.background,
                gradient: customization.header.linkColor?.[theme] || colors.gradient,
                title: customization.header.linkColor?.[theme] || colors.title,
                body: colorContrast(
                    customization.header.backgroundColor?.[theme] || colors.background,
                    [baseColors.light, baseColors.dark]
                ),
            };
            gridAsset = colors.body === baseColors.light ? gridWhite : gridBlack;
            break;

        case CustomizationHeaderPreset.Bold:
            colors = {
                background: customization.styling.primaryColor[theme],
                gradient: colorContrast(customization.styling.primaryColor[theme], [
                    baseColors.light,
                    baseColors.dark,
                ]),
                title: colorContrast(customization.styling.primaryColor[theme], [
                    baseColors.light,
                    baseColors.dark,
                ]),
                body: colorContrast(customization.styling.primaryColor[theme], [
                    baseColors.light,
                    baseColors.dark,
                ]),
            };
            gridAsset = colors.body === baseColors.light ? gridWhite : gridBlack;
            break;
    }

    const favicon = await (async () => {
        if ('icon' in customization.favicon)
            return (
                <img
                    src={customization.favicon.icon[theme]}
                    width={40}
                    height={40}
                    tw="mr-4"
                    alt="Icon"
                />
            );
        if ('emoji' in customization.favicon)
            return (
                <span tw="text-4xl mr-4">
                    {String.fromCodePoint(Number.parseInt(`0x${customization.favicon.emoji}`))}
                </span>
            );
        const src = await readSelfImage(
            linker.toAbsoluteURL(
                linker.toPathInSpace(
                    `~gitbook/icon?size=medium&theme=${customization.themes.default}`
                )
            )
        );
        return <img src={src} alt="Icon" width={40} height={40} tw="mr-4" />;
    })();

    return new ImageResponse(
        <div
            tw={`justify-between p-20 relative w-full h-full flex flex-col bg-[${colors.background}] text-[${colors.body}]`}
            style={{
                fontFamily,
            }}
        >
            {/* Gradient */}
            <div
                tw="absolute inset-0"
                style={{
                    backgroundImage: `radial-gradient(ellipse 100% 100% at top right , ${colors.gradient},${colors.gradient}00)`,
                    opacity: 0.5,
                }}
            />

            {/* Grid */}
            <img
                tw="absolute inset-0 w-[100vw] h-[100vh]"
                src={await readStaticImage(gridAsset)}
                alt="Grid"
            />

            {/* Logo */}
            {customization.header.logo ? (
                <img
                    alt="Logo"
                    height={60}
                    src={
                        useLightTheme
                            ? customization.header.logo.light
                            : customization.header.logo.dark
                    }
                />
            ) : (
                <div tw="flex">
                    {favicon}
                    <h3 tw="text-4xl my-0 font-bold">{contentTitle}</h3>
                </div>
            )}

            {/* Title and description */}
            <div tw="flex flex-col">
                <h1
                    tw={`text-8xl my-0 tracking-tight leading-none text-left text-[${colors.title}] font-bold`}
                >
                    {pageTitle}
                </h1>
                {pageDescription ? (
                    <h2 tw="text-4xl mb-0 mt-8 w-[75%] font-normal">{pageDescription}</h2>
                ) : null}
            </div>
        </div>,
        {
            width: 1200,
            height: 630,
            fonts: fonts.length ? fonts : undefined,
            headers: {
                'cache-tag': [
                    getCacheTag({
                        tag: 'site',
                        site: baseContext.site.id,
                    }),
                    getCacheTag({
                        tag: 'space',
                        space: baseContext.space.id,
                    }),
                ].join(','),
            },
        }
    );
}

async function loadGoogleFont(input: {
    font: CustomizationDefaultFont;
    text: string;
    weight: FontWeight;
}) {
    const lookup = getDefaultFont({
        font: input.font,
        text: input.text,
        weight: input.weight,
    });

    // If we found a font file, load it
    if (lookup) {
        return getWithCache(`google-font-files:${lookup.url}`, async () => {
            const response = await fetch(lookup.url);
            if (response.ok) {
                const data = await response.arrayBuffer();
                return {
                    name: lookup.font,
                    data,
                    style: 'normal' as const,
                    weight: input.weight,
                };
            }
        });
    }

    // If for some reason we can't load the font, we'll just use the default one
    return null;
}

async function loadCustomFont(input: { url: string; weight: 400 | 700 }) {
    const { url, weight } = input;
    const response = await fetch(url);
    if (!response.ok) {
        return null;
    }

    const data = await response.arrayBuffer();

    return {
        name: 'CustomFont',
        data,
        style: 'normal' as const,
        weight,
    };
}

/**
 * Temporary function to log some data on Cloudflare.
 * TODO: remove this when we found the issue
 */
function logOnCloudflareOnly(message: string) {
    if (process.env.DEBUG_CLOUDFLARE === 'true') {
        // biome-ignore lint/suspicious/noConsole: <explanation>
        console.log(message);
    }
}

/**
 * Read an image from a response as a base64 encoded string.
 */
async function readImage(response: Response) {
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
        logOnCloudflareOnly(`Invalid content type: ${contentType}, 
            status: ${response.status}
            rayId: ${response.headers.get('cf-ray')}`);
        throw new Error(`Invalid content type: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return `data:${contentType};base64,${base64}`;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const staticCache = new Map<string, any>();

// Do we need to limit the in-memory cache size? I think given the usage, we should be fine.
async function getWithCache<T>(key: string, fn: () => Promise<T>) {
    const cached = staticCache.get(key) as T;
    if (cached) {
        return Promise.resolve(cached);
    }

    const result = await fn();
    staticCache.set(key, result);
    return result;
}

/**
 * Read a static image and cache it in memory.
 */
async function readStaticImage(url: string) {
    logOnCloudflareOnly(`Reading static image: ${url}, cache size: ${staticCache.size}`);
    return getWithCache(`static-image:${url}`, () => readSelfImage(url));
}

/**
 * Read an image from GitBook itself.
 */
async function readSelfImage(url: string) {
    const response = await fetch(url);
    const image = await readImage(response);
    return image;
}
