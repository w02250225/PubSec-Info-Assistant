import { DetailsList, IColumn, SelectionMode } from '@fluentui/react/lib/DetailsList';
import { IGroup } from '@fluentui/react/lib/GroupedList';

import { AllChatHistory } from "../../api"
import styles from "./ChatHistoryPanel.module.css";
import { MessageBar, MessageBarType, Spinner, SpinnerSize } from '@fluentui/react';

interface Props {
  className?: string;
  chatHistory: AllChatHistory | undefined;
  onConversationClicked: (conversation_id: string) => void;
  disabled?: boolean;
}

export const ChatHistoryPanel = ({ className, chatHistory, onConversationClicked, disabled }: Props) => {

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
      <Spinner size={SpinnerSize.large} label="Loading chat history..." ariaLive="assertive" labelPosition="bottom" />
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
      key: 'columnConversationName',
      name: 'Conversation',
      fieldName: 'conversation_name',
      minWidth: 100,
      maxWidth: 300,
    },
  ];

  return (
    <div className={className}>
      <DetailsList
        className={styles.chatHistoryList}
        items={chatHistory.history}
        columns={columns}
        groups={groups}
        indentWidth={0}
        selectionMode={SelectionMode.none}
        onItemInvoked={(item) => onConversationClicked(item.conversation_id)}
        isHeaderVisible={false} // Hide column headers
      />
    </div>
  );
};
