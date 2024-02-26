import { useEffect, useState } from 'react';
import { Stack, Spinner, SpinnerSize } from '@fluentui/react';
import DOMPurify from "dompurify";

import { getFaq, FaqContent } from "../../api";
import styles from "./FAQ.module.css";

const FAQ = () => {
    const [faqData, setFaqData] = useState<FaqContent | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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

    return (
        <Stack className={styles.faqContainer}>
            {isLoading && (
                <Spinner size={SpinnerSize.large} label="Loading Data..." ariaLive="assertive" />
            )}
            {!isLoading && faqData && faqData.content && (
                <Stack.Item>
                    <div dangerouslySetInnerHTML={createMarkup(faqData.content)} />
                </Stack.Item>
            )}
        </Stack>
    );
};

export default FAQ;