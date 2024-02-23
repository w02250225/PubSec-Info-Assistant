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
  onConversationUpdated: (conversation_id: string, new_name?: string, archived?: boolean) => void;
};

export const ChatHistoryPanel = ({ className, chatHistory, onConversationClicked, onConversationUpdated }: Props) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
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
    // Existing columns...
    {
      key: 'conversation_name',
      name: 'Conversation',
      fieldName: 'conversation_name',
      minWidth: 280,
      maxWidth: 280,
      data: 'string',
    },
    {
      key: 'edit',
      name: '',
      fieldName: 'edit',
      minWidth: 20,
      maxWidth: 20,
      onRender: (item?: Conversation) => {
        return (
          <div className={styles.editIconCell}>
            <TooltipHost content="Rename">
              <Icon iconName="Edit" onClick={(event) => showEditDialog(item!, event)} className={styles.editIcon} />
            </TooltipHost>
          </div>
        );
      },
    },
    {
      key: 'archive',
      name: '',
      fieldName: 'archive',
      minWidth: 20,
      maxWidth: 20,
      onRender: (item?: Conversation) => {
        return (
          <div className={styles.archiveIconCell}>
            <TooltipHost content="Archive">
              <Icon iconName="Archive" onClick={(event) => showArchiveDialog(item!, event)} className={styles.archiveIcon} />
            </TooltipHost>
          </div>
        );
      },
    },
  ];

  const showEditDialog = (item: Conversation, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation(); // Prevents the click event from bubbling up to the parent elements
    setEditingText(item.conversation_name);
    setEditingItemId(item.conversation_id);
    setIsEditDialogOpen(true);
  };

  const onSaveEdit = () => {
    const currentConversation = chatHistory?.history.find(item => item.conversation_id === editingItemId);

    // Check if the conversation name has changed
    if (currentConversation && editingText !== currentConversation.conversation_name) {
      onConversationUpdated(editingItemId, editingText, undefined);
    };

    setEditingItemId('');
    setEditingText('');
    setIsEditDialogOpen(false);
  };

  const showArchiveDialog = (item: Conversation, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation(); // Prevents the click event from bubbling up to the parent elements
    setEditingItemId(item.conversation_id);
    setIsArchiveDialogOpen(true);
  };

  const onArchiveConfirmed = () => {
    onConversationUpdated(editingItemId, undefined, true);
    setEditingItemId('');
    setIsArchiveDialogOpen(false);
  };

  const onRenderRow: IRenderFunction<IDetailsRowProps> = (props?: IDetailsRowProps): JSX.Element | null => {
    if (!props) {
      return null;
    };

    const onRowClick = (event: React.MouseEvent<HTMLElement>) => {
      // This checks if the click is from an element that is not an icon or tooltip for icons
      if (!(event.target as HTMLElement).closest(`.${styles.iconClass}`)) {
        onConversationClicked(props.item.conversation_id);
      }
    };

    // Prepare Tooltip content for the conversation
    const tooltipContent = (
      <>
        <b>{props.item.conversation_name}</b>
        <br />
        {props.item.conversation_end}
      </>
    );

    // Apply the TooltipHost only to the clickable part of the row
    return (
      <div className={styles.conversationRow} onClick={onRowClick}>
        <TooltipHost content={tooltipContent} className={styles.tooltip}>
          <DetailsRow {...props} />
        </TooltipHost>
        {/* Icons are rendered in their own columns now and have their own Tooltips */}
      </div>
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
        hidden={!isEditDialogOpen}
        onDismiss={() => setIsEditDialogOpen(false)}
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
          <PrimaryButton onClick={onSaveEdit} text="Save" />
          <PrimaryButton onClick={() => setIsEditDialogOpen(false)} text="Cancel" />
        </DialogFooter>
      </Dialog>
      <Dialog
        hidden={!isArchiveDialogOpen}
        onDismiss={() => setIsArchiveDialogOpen(false)}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Are you sure you want to archive this conversation?',
        }}
        modalProps={{ isBlocking: true }}
      >
        <DialogFooter>
          <PrimaryButton onClick={onArchiveConfirmed} text="Yes" />
          <PrimaryButton onClick={() => setIsArchiveDialogOpen(false)} text="No" />
        </DialogFooter>
      </Dialog>
    </>
  );
};