import { Platform } from 'react-native';
export const colors = { bg:'#061316', surface:'#0D2024', surface2:'#12282C', border:'#1F3A3E', text:'#F4FAF9', muted:'#91A8A9', accent:'#18E0C0', accentDark:'#0B8F7B', danger:'#FF5964', warning:'#F5BE42', success:'#25D6A5' } as const;
export const spacing = { xs:4, sm:8, md:16, lg:24, xl:32, xxl:48 } as const;
export const radius = { sm:8, md:12, lg:18, pill:999 } as const;
export const Fonts = Platform.select({ios:{sans:'System',rounded:'ui-rounded'},default:{sans:'normal',rounded:'normal'}});
export const MaxContentWidth = 760;
