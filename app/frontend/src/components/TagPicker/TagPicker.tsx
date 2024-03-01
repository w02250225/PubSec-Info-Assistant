// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.
import { useState, useEffect } from 'react';
import { TagPicker, ITag } from '@fluentui/react/lib/Pickers';
import { Label, ITooltipHostStyles, Icon } from "@fluentui/react";
import { FiHelpCircle } from 'react-icons/fi';
import { mergeStyles } from '@fluentui/react/lib/Styling';
import { useId } from '@fluentui/react-hooks';
import { getAllTags } from "../../api";

import styles from "./TagPicker.module.css";

var allowAddNew = false;

interface Props {
  className?: string;
  allowNewTags?: boolean;
  onSelectedTagsChange: (selectedTags: ITag[]) => void;
  preSelectedTags?: ITag[];
}

export const TagPickerInline = ({ className, allowNewTags, onSelectedTagsChange, preSelectedTags }: Props) => {

  allowAddNew = allowNewTags as boolean;
  const pickerId = useId('tag-inline-picker');
  const newItem = mergeStyles({ color: '#f00', background: '#ddf', padding: '10px' });
  const existingItem = mergeStyles({ color: '#222', padding: '10px' });

  const [selectedTags, setSelectedTags] = useState<ITag[]>([]);
  const [tags, setTags] = useState<ITag[]>([]);
  const getTextFromItem = (item: ITag) => item.name;
  const tooltipHtml = allowAddNew ? "Tags to append to each document uploaded below. Max 10" : "Tags to filter documents by. Max 10"

  const listContainsTagList = (tag: ITag, tagList?: ITag[]): boolean => {
    if (!tagList || !tagList.length || tagList.length === 0) {
      return false;
    }
    return tagList.some((compareTag: ITag) => compareTag.key === tag.key);
  };

  const filterSuggestedTags = (filterText: string, tagList: ITag[] | undefined): ITag[] => {
    if (filterText) {
      // Lowercase the filter text for case-insensitive comparison
      const filterTextLower = filterText.toLowerCase();

      // Filter for existing tags that start with the filter text and aren't already selected
      let existingMatches = tags.filter(tag =>
        tag.name.toLowerCase().startsWith(filterTextLower) &&
        !listContainsTagList(tag, tagList)
      );

      // Check if the filter text is already used as a key (case-insensitive) in the existing or selected tags
      let isNewItem = !existingMatches.some(tag => tag.name.toLowerCase() === filterTextLower) &&
        !(tagList?.some(tag => tag.name.toLowerCase() === filterTextLower));

      // If a new tag should be allowed, and the text isn't an existing tag, offer to add the new tag
      if (allowAddNew && isNewItem) {
        existingMatches = existingMatches.concat([{ key: filterText, name: filterText, isNewItem: true } as ITag]);
      }

      return existingMatches;
    }

    return []; // If filterText is empty, return an empty array
  };

  const onItemSelected = (item: any | undefined): ITag | PromiseLike<ITag> | null => {
    // Check if the item is empty, blank, whitespace or only contains non-alphanumeric characters
    if (!item || !item.name.trim() || !/[a-zA-Z0-9]/.test(item.name)) {
      return null; // Invalid item, prevent adding
    }

    if (item && item.isNewItem) {
      item.isNewItem = false;
      var newTags = [...tags, item]; // Use spread syntax for immutability
      setTags(newTags);
    }

    return item as ITag;
  };

  const onRenderSuggestionsItem = (props: any, itemProps: any): JSX.Element => {
    if (allowAddNew) {
      return <div className={props.isNewItem ? newItem : existingItem} key={props.key}>
        {props.name}
        {props.isNewItem && <Icon iconName="Add" className={styles.addIcon} />}
      </div>;
    }
    else {
      return <div className={existingItem} key={props.key}>
        {props.name}
      </div>;
    }
  };

  async function fetchTagsFromCosmos() {
    try {
      if (preSelectedTags !== undefined && preSelectedTags.length > 0) {
        setSelectedTags(preSelectedTags);
        onSelectedTagsChange(preSelectedTags);
      }
      else {
        setSelectedTags([]);
        onSelectedTagsChange([]);
      }
      const response = await getAllTags();
      var newTags: ITag[] = [];
      response.tags.split(",").forEach((tag: string) => {
        const trimmedTag = tag.trim();
        if (trimmedTag !== "" && !newTags.some(t => t.key === trimmedTag)) {
          const newTag: any = { key: trimmedTag, name: trimmedTag, isNewItem: false };
          newTags.push(newTag);
        }
      });
      setTags(newTags);
    }
    catch (error) {
      console.log(error);
    }
  }

  const onChange = (items?: ITag[] | undefined) => {
    if (items) {
      setSelectedTags(items);
      onSelectedTagsChange(items);
    }
  };

  useEffect(() => {
    fetchTagsFromCosmos();
  }, []);

  return (
    <div className={`${styles.tagArea} ${className ?? ""}`}>
      <div className={styles.tagSelection}>
        <div className={allowAddNew ? styles.rootClass : styles.rootClassFilter}>
          <Label htmlFor={pickerId}>Tags&nbsp;
            <FiHelpCircle
              data-tooltip-id="TagSelection-tooltip"
              data-tooltip-html={tooltipHtml}>
            </FiHelpCircle>
          </Label>
          <TagPicker
            className={styles.tagPicker}
            removeButtonAriaLabel="Remove"
            selectionAriaLabel="Tags"
            onResolveSuggestions={filterSuggestedTags}
            onRenderSuggestionsItem={onRenderSuggestionsItem}
            getTextFromItem={getTextFromItem}
            itemLimit={10}
            // this option tells the picker's callout to render inline instead of in a new layer
            pickerCalloutProps={{ doNotLayer: false }}
            inputProps={{
              id: pickerId
            }}
            onItemSelected={onItemSelected}
            selectedItems={selectedTags}
            onChange={onChange}
          />
        </div>

      </div>
    </div >
  );
};
