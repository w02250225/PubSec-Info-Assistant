import {
  Dialog, DialogType, DialogFooter, PrimaryButton, TextField, DetailsList, DetailsRow,
  IDetailsRowProps, IColumn, IGroup, SelectionMode
} from '@fluentui/react';

import { ConversationHistory, Conversation } from "../../api"
import styles from "./ChatHistoryPanel.module.css";
import { IRenderFunction, Icon, MessageBar, MessageBarType, Spinner, SpinnerSize, TooltipHost } from '@fluentui/react';
import { useState } from 'react';

interface Props {
  className?: string;
  chatHistory: ConversationHistory | undefined;
  onConversationClicked: (conversation_id: string) => void;
  onConversationRenamed: (conversation_id: string, new_name: string) => void;
};

export const ChatHistoryPanel = ({ className, chatHistory, onConversationClicked, onConversationRenamed }: Props) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingText, setEditingText] = useState('');
  const [editingItemId, setEditingItemId] = useState('');

  // Early return for error
  if (chatHistory?.error) {
    return (<div className={className}>
      <MessageBar
        messageBarType={MessageBarType.error}
        isMultiline={false}>
        {chatHistory.error}
      </MessageBar>
    </div>
    )
  };

  // Early return for loading state when chatHistory is undefined or null
  if (chatHistory?.history === undefined || chatHistory.history === null) {
    return (<div className={className}>
      <Spinner size={SpinnerSize.large} label="Loading chat history..." ariaLive="assertive" />
    </div>
    )
  };

  // Early return for "No History Found" message when chatHistory is an empty array
  if (chatHistory.history.length === 0) {
    return (<div className={className}>
      <MessageBar
        messageBarType={MessageBarType.warning}
        isMultiline={false}>
        No Chat History Found
      </MessageBar>
    </div>
    )
  };

  // Extract unique date_categories to create groups
  const groups: IGroup[] = chatHistory.history.length > 0 ? chatHistory.history
    .map(item => item.date_category) // Get all date_categories
    .filter((value, index, self) => self.indexOf(value) === index) // Filter unique values
    .map((category, index) => {
      // Find the range of items for each category
      const startIndex = chatHistory.history.findIndex(item => item.date_category === category);
      const count = chatHistory.history.filter(item => item.date_category === category).length;

      return {
        key: `group${index}`,
        name: category,
        startIndex,
        count,
      };
    }) : []; // Return an empty array if chatHistory is not available

  const columns: IColumn[] = [
    {
      key: 'conversation_name',
      name: 'Conversation',
      fieldName: 'conversation_name',
      minWidth: 100,
      maxWidth: 300,
    },
  ];

  const showDialog = (item: Conversation, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation(); // Prevents the click event from bubbling up to the parent elements
    setEditingText(item.conversation_name);
    setEditingItemId(item.conversation_id);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
  };

  const saveEdit = () => {
    const currentConversation = chatHistory?.history.find(item => item.conversation_id === editingItemId);

    // Check if the conversation name has changed
    if (currentConversation && editingText !== currentConversation.conversation_name) {
      onConversationRenamed(editingItemId, editingText);
    };

    setEditingItemId('');
    setEditingText('');
    setIsDialogOpen(false);
  };

  const onRenderItemColumn = (item?: Conversation, index?: number, column?: IColumn) => {
    if (item && column && column.fieldName) {
      return (
        <div className={styles.rowCell}>
          <span className={styles.conversationText}>
            {item[column.fieldName as keyof Conversation]}
          </span>
          <TooltipHost content="Rename" styles={{ root: { display: 'inline-block' } }}>
            <Icon iconName="Edit" onClick={(event) => showDialog(item, event)} className={styles.editIcon} />
          </TooltipHost>
        </div>
      );
    }
    return null;
  };

  const onRenderRow: IRenderFunction<IDetailsRowProps> = (props?: IDetailsRowProps): JSX.Element | null => {
    // This allows the whole row/cell to be clickable
    if (!props) {
      return null;
    };

    const onRowClick = () => {
      if (props.item && props.item.conversation_id) {
        onConversationClicked(props.item.conversation_id);
      }
    };

    // Prepare Tooltip content
    const tooltipContent = (
      <>
        <b>{props.item.conversation_name}</b>
        <br />
        {props.item.conversation_end}
      </>
    );

    return (
      <TooltipHost content={tooltipContent} className={styles.tooltip}>
        <div className={styles.conversationRow} onClick={onRowClick}>
          <DetailsRow {...props} onRenderItemColumn={onRenderItemColumn} />
        </div>
      </TooltipHost>
    );
  };

  return (
    <>
      <div className={className}>
        <DetailsList
          items={chatHistory.history}
          columns={columns}
          groups={groups}
          indentWidth={0}
          selectionMode={SelectionMode.none}
          onRenderRow={onRenderRow}
          isHeaderVisible={false} // Hide column headers
        />
      </div>
      <Dialog
        hidden={!isDialogOpen}
        onDismiss={closeDialog}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Edit Conversation Name',
        }}
        modalProps={{
          isBlocking: true,
          styles: { 
            main: { 
              maxWidth: '750px !important', 
              minWidth: '500px !important', 
            },
          },
        }}
      >
        <TextField value={editingText} onChange={(e, newValue) => setEditingText(newValue || '')} />
        <DialogFooter>
          <PrimaryButton onClick={saveEdit} text="Save" />
          <PrimaryButton onClick={closeDialog} text="Cancel" />
        </DialogFooter>
      </Dialog>
    </>
  );
};