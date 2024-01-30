import { useEffect, useState } from 'react';
import { Icon, Stack, Spinner, SpinnerSize } from '@fluentui/react';
import DOMPurify from "dompurify";

import { getFaq, FaqContent, FaqQuestion } from "../../api";

import styles from "./FAQ.module.css";

const FAQ = () => {
    const [faqData, setFaqData] = useState<FaqContent | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

    useEffect(() => {
        async function fetchFaqData() {
            try {
                const response: FaqContent = await getFaq();
                setFaqData(response);
                setIsLoading(false);

            } catch (error) {
                console.error('Error fetching FAQ:', error);
                setIsLoading(false);
            }
        }
        fetchFaqData();
    }, []);

    const createMarkup = (htmlContent: string) => {
        return { __html: DOMPurify.sanitize(htmlContent) };
    };

    const toggleExpand = (index: number) => {
        const newExpandedItems = new Set(expandedItems);
        if (newExpandedItems.has(index)) {
            newExpandedItems.delete(index);
        } else {
            newExpandedItems.add(index);
        }
        setExpandedItems(newExpandedItems);
    };

    return (
        <Stack tokens={{ childrenGap: 10 }} className={styles.faqContainer}>
            {isLoading && (
                <Spinner size={SpinnerSize.large} label="Loading Data..." ariaLive="assertive" labelPosition="right" />
            )}
            {!isLoading && faqData && (
                <>
                    {faqData.content && (
                        <Stack.Item>
                            <div dangerouslySetInnerHTML={createMarkup(faqData.content)} />
                        </Stack.Item>
                    )}
                    {faqData.questions.map((item: FaqQuestion, index: number) => (
                        <Stack.Item key={index} className={styles.faqItem}>
                            <h3 onClick={() => toggleExpand(index)}>
                                <Icon iconName={expandedItems.has(index) ? "ChevronUp" : "ChevronDown"} className={styles.faqIcon} />
                                <span dangerouslySetInnerHTML={createMarkup(item.question)} />
                            </h3>
                            {expandedItems.has(index) && (
                                <p dangerouslySetInnerHTML={createMarkup(item.answer)}></p>
                            )}
                        </Stack.Item>
                    ))}
                </>
            )}
        </Stack>
    );
};

export default FAQ;