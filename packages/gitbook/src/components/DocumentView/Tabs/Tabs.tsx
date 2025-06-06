import type { DocumentBlockTabs } from '@gitbook/api';

import { tcls } from '@/lib/tailwind';

import type { BlockProps } from '../Block';
import { Blocks } from '../Blocks';
import { DynamicTabs, type TabsItem } from './DynamicTabs';

export function Tabs(props: BlockProps<DocumentBlockTabs>) {
    const { block, ancestorBlocks, document, style, context } = props;

    const tabs: TabsItem[] = [];
    const tabsBody: React.ReactNode[] = [];

    block.nodes.forEach((tab, index) => {
        tabs.push({
            id: tab.meta?.id ?? tab.key!,
            title: tab.data.title ?? '',
        });

        tabsBody.push(
            <Blocks
                key={tab.key ?? index}
                nodes={tab.nodes}
                document={document}
                ancestorBlocks={[...ancestorBlocks, block, tab]}
                context={context}
                blockStyle={tcls('flip-heading-hash')}
                style={tcls('w-full', 'space-y-4')}
            />
        );
    });

    if (context.mode === 'print') {
        // When printing, we display the tab, one after the other
        return (
            <>
                {tabs.map((tab, index) => (
                    <DynamicTabs
                        key={tab.id}
                        id={block.key!}
                        block={block}
                        tabs={[tab]}
                        tabsBody={[tabsBody[index]]}
                        style={style}
                    />
                ))}
            </>
        );
    }

    return (
        <DynamicTabs id={block.key!} block={block} tabs={tabs} tabsBody={tabsBody} style={style} />
    );
}
