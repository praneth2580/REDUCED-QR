import HuffmanDemoUI from './demos/huffman.ui';
import BasicRLEDemoUI from './demos/basic_rle.ui';
import DictionaryDemoUI from './demos/dictionary.ui';
import HuffmanWordDemoUI from './demos/huffman.word.ui';
import DictionaryGroupDemoUI from './demos/dictionary.group.ui';
import HuffmanDictionaryDemoUI from './demos/huffman_dict_group.ui';

export const routesConfig = [
  {
    path: '/',
    name: 'Home',
    inNav: true,
  },
  {
    path: '/demo',
    name: 'Demos',
    inNav: true,
    children: [
      {
        path: 'huffman',
        element: <HuffmanDemoUI />,
        name: 'Huffman (Characters)',
        inNav: true,
      },
      {
        path: 'huffman-word',
        element: <HuffmanWordDemoUI />,
        name: 'Huffman (Words)',
        inNav: true,
      },
      {
        path: 'rle',
        element: <BasicRLEDemoUI />,
        name: 'RLE Encoder',
        inNav: true,
      },
      {
        path: 'dictionary',
        element: <DictionaryDemoUI />,
        name: 'Dictionary (Words)',
        inNav: true,
      },
      {
        path: 'dictionary-group',
        element: <DictionaryGroupDemoUI />,
        name: 'Dictionary (Groups)',
        inNav: true,
      },
      {
        path: 'huffman-dictionary-group',
        element: <HuffmanDictionaryDemoUI />,
        name: 'Huffman -> Dictionary (Groups)',
        inNav: true,
      },
    ],
  },
];
