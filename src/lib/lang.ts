const zh = {
  setting: {
    save_to: {
      title: '保存至',
      label: {
        directory: '保存位置',
        filename: '文件名'
      },
      options: {
        use_fsa: '使用FileSystemAccess API',
        fsa_directory: '选择保存文件夹',
        fsa_filename_conflict: '当文件名重复时',
        tag_language: '使用的标签语言',
        tag_language_tips: '无翻译的标签仍可能是其他语言'
      },
      button: {
        choose_fsa_directory: '浏览'
      },
      radio: {
        filename_conflict_option_uniquify: '重命名',
        filename_conflict_option_overwrite: '覆盖',
        filename_conflict_option_prompt: '提示'
      },
      placeholder: {
        sub_directory_unused: '如不需要保存到子目录，此行留空即可',
        vm_not_supported: 'Violentmonkey不支持',
        need_browser_api: '请将下载模式设置为"Browser Api"',
        filename_requried: '必填'
      }
    },
    ugoira: {
      title: '动图转换',
      label: {
        format: '动图格式',
        quality: '动图质量'
      },
      options: {
        select_format: '将动图转换到所选格式',
        gif_tips: '数值越低颜色越好，但处理速度显著减慢',
        webm_tips: '0最差，99最好',
        webp_lossy: '无损转换',
        webp_quality: '图片质量',
        webp_quality_tips:
          '有损：0表示文件最小，100表示文件最大。无损：0最快，但文件较大，100最慢，但质量最好。',
        webp_method: '压缩方法',
        webp_method_tips: '0=快，6=慢但效果更好',
        png_tips: '颜色数量。0：所有颜色（无损PNG）'
      }
    },
    history: {
      title: '下载历史',
      label: {
        export: '导出',
        import: '导入',
        clear: '清理'
      },
      options: {
        export_as_json: '将下载历史导出为JSON文件',
        export_as_csv: '将下载历史导出为CSV文件',
        import_json: '导入JSON格式下载历史',
        clear_history: '清除下载历史'
      },
      button: {
        export: '导出记录',
        import: '导入记录',
        clear: '清除记录'
      }
    },
    button_position: {
      title: '按钮位置',
      label: {
        common: '通用',
        my_bookmark: '我的收藏'
      },
      options: {
        horizon_position: '水平位置',
        vertical_position: '垂直位置'
      }
    },
    others: {
      title: '其它',
      options: {
        show_setting_button: '显示设置按钮',
        bundle_multipage_illust: '将多页插图打包为zip压缩包',
        bundle_manga: '将漫画作品打包为zip压缩包',
        add_bookmark_when_download: '下载单个作品时收藏作品',
        add_bookmark_with_tags: '收藏时添加作品标签',
        add_bookmark_private_r18: '将R-18作品收藏到不公开类别'
      }
    },
    feedback: {
      title: '反馈 / 赞赏',
      label: {
        feedback: '反馈',
        donate: '赞赏'
      },
      text: {
        feedback_desc: `				如果你在使用中发现了问题或有改进建议，欢迎到<a
					href="https://sleazyfork.org/zh-CN/scripts/432150-pixiv-downloader/feedback"
					target="_blank"
					class=" anchor">此链接</a
				>反馈。`,
        donate_desc: '如果脚本有帮助到你，欢迎扫码请我喝杯可乐 ^_^'
      }
    }
  },

  downloader: {
    category: {
      tab_name: '类别',
      filter: {
        exclude_downloaded: '排除已下载',
        download_all_pages: '下载所有页',
        download_selected_pages: '自定义页数',
        pixiv_illust: '插画',
        pixiv_manga: '漫画',
        pixiv_ugoira: '动图'
      }
    },

    tag_filter: {
      tab_name: '标签',
      placeholder: {
        blacklist_tag: '黑名单，将排除含有以下标签的作品。',
        whitelist_tag: '白名单，只下载包含以下标签的作品。'
      }
    },

    download_type: {
      stop: '停止',
      pixiv_works: '作品',
      pixiv_bookmark: '收藏',
      pixiv_bookmark_public: '公开收藏',
      pixiv_bookmark_private: '不公开收藏',
      pixiv_follow_latest_all: '全部',
      pixiv_follow_latest_r18: 'R-18'
    }
  },

  button: {
    setting: '设置',
    download_stop: '停止',
    download_works: '作品',
    download_bookmarks: '收藏',
    download_bookmarks_public: '公开',
    download_bookmarks_private: '不公开',
    download_all_one_page: '全部（单页）',
    download_all: '全部（批量）',
    download_r18_one_page: 'R-18（单页）',
    download_r18: 'R-18（批量）'
  },
  checkbox: {
    filter_exclude_downloaded: '排除已下载图片',
    filter_illusts: '插画',
    filter_manga: '漫画',
    filter_ugoira: '动图'
  },
  text: {
    confirm_clear_history: '真的要清除历史记录吗？'
  }
};

const en: typeof zh = {
  setting: {
    save_to: {
      title: 'Save To',
      label: {
        directory: 'Save Path',
        filename: 'Filename'
      },
      options: {
        use_fsa: 'Use FileSystemAccess API',
        fsa_directory: 'Select directory',
        fsa_filename_conflict: 'When filename conflicts',
        tag_language: 'Tag Language',
        tag_language_tips: 'Tags without translation may still be in another language'
      },
      button: {
        choose_fsa_directory: 'Browse'
      },
      radio: {
        filename_conflict_option_uniquify: 'Uniquify',
        filename_conflict_option_overwrite: 'Overwrite',
        filename_conflict_option_prompt: 'Prompt'
      },
      placeholder: {
        sub_directory_unused: 'Leave folder name blank if not saving to a subdirectory',
        vm_not_supported: 'Not supported by Violentmonkey',
        need_browser_api: 'Browser API required',
        filename_requried: 'Required'
      }
    },
    ugoira: {
      title: 'Ugoira',
      label: {
        format: 'Ugoira Format',
        quality: 'Ugoira Quality'
      },
      options: {
        select_format: 'Convert Ugoira to selected format',
        gif_tips: 'Lower values produce better colors, but slow processing significantly',
        webm_tips: '0 (worst) to 99 (best)',
        webp_lossy: 'Lossless Webp',
        webp_quality: 'Image Quality',
        webp_quality_tips:
          'For lossy, 0 gives the smallest size and 100 the largest. For lossless, 0 is the fastest but gives larger files compared to the slowest, but best, 100.',
        webp_method: 'Compression Method',
        webp_method_tips: 'Quality/speed trade-off (0=fast, 6=slower-better)',
        png_tips: 'Number of colors in the result; 0: all colors (lossless PNG)'
      }
    },
    history: {
      title: 'History',
      label: {
        export: 'Export',
        import: 'Import',
        clear: 'Clear'
      },
      options: {
        export_as_json: 'Export download history as JSON file',
        export_as_csv: 'Export download history as CSV file',
        import_json: 'Import JSON format download history',
        clear_history: 'Clear download history'
      },
      button: {
        export: 'Export',
        import: 'Import',
        clear: 'Clear'
      }
    },
    button_position: {
      title: 'Button',
      label: {
        common: 'Common',
        my_bookmark: 'My Bookmark'
      },
      options: {
        horizon_position: 'Horizontal Position',
        vertical_position: 'Vertical Position'
      }
    },
    others: {
      title: 'Others',
      options: {
        show_setting_button: 'Show Setting Button',
        bundle_multipage_illust: 'Bundle multipage illustrations into a zip file',
        bundle_manga: 'Bundle manga into a zip file',
        add_bookmark_when_download: 'Bookmark artwork when downloading',
        add_bookmark_with_tags: 'Add tags when bookmarking',
        add_bookmark_private_r18: 'Bookmark R-18 artwork as private'
      }
    },
    feedback: {
      title: 'Feedback',
      label: {
        feedback: 'Feedback',
        donate: 'Donate'
      },
      text: {
        feedback_desc: `If you encounter any issues or have suggestions for improvements, feel free to provide feedback <a href="https://sleazyfork.org/zh-CN/scripts/432150-pixiv-downloader/feedback" target="_blank" class=" anchor">here</a>.`,
        donate_desc: '如果脚本有帮助到你，欢迎扫码请我喝杯可乐 ^_^'
      }
    }
  },

  downloader: {
    category: {
      tab_name: 'Category',
      filter: {
        exclude_downloaded: 'Exclude Downloaded',
        download_all_pages: 'All Pages',
        download_selected_pages: 'Custom Pages',
        pixiv_illust: 'Illustration',
        pixiv_manga: 'Manga',
        pixiv_ugoira: 'Ugoira'
      }
    },
    tag_filter: {
      tab_name: 'Tags',
      placeholder: {
        blacklist_tag: 'Blacklist: Exclude works with these tags.',
        whitelist_tag: 'Whitelist: Only download works with these tags.'
      }
    },
    download_type: {
      stop: 'Stop',
      pixiv_works: 'Works',
      pixiv_bookmark: 'Bookmarks',
      pixiv_bookmark_public: 'Public',
      pixiv_bookmark_private: 'Private',
      pixiv_follow_latest_all: 'All',
      pixiv_follow_latest_r18: 'R-18'
    }
  },

  button: {
    setting: 'Setting',
    download_stop: 'Stop',
    download_works: 'Works',
    download_bookmarks: 'Bookmarks',
    download_bookmarks_public: 'Public',
    download_bookmarks_private: 'Private',
    download_all_one_page: 'All (one page)',
    download_all: 'All',
    download_r18_one_page: 'R-18 (one page)',
    download_r18: 'R-18'
  },
  checkbox: {
    filter_exclude_downloaded: 'Exclude downloaded',
    filter_illusts: 'Illustrations',
    filter_manga: 'Manga',
    filter_ugoira: 'Ugoira'
  },

  text: {
    confirm_clear_history: 'Do you really want to clear history?'
  }
};

const messages = {
  'zh-cn': zh,
  'zh-tw': zh,
  zh,
  en
};

const curLang = navigator.language.toLowerCase();
const lang = (curLang in messages ? curLang : 'en') as keyof typeof messages;

export default function t(key: string) {
  const paths: string[] = key.split('.');

  let last: any = messages[lang];
  for (let i = 0; i < paths.length; i++) {
    const value: any = last[paths[i]];
    if (value === undefined || value === null) return null;
    last = value;
  }
  return last;
}
