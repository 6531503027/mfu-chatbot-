import React from "react";

interface LinkifyProps {
    text: string;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
const EMAIL_REGEX = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
const PHONE_REGEX = /(\d{2,4}-?\d{3,4}-?\d{3,4})/g;

export default function Linkify({ text }: LinkifyProps) {
    // Split text by newlines to preserve line breaks
    const lines = text.split('\n');

    return (
        <>
            {lines.map((line, lineIndex) => {
                const parts: React.ReactNode[] = [];
                const processedParts: React.ReactNode[] = [];

                // Split by whitespace but keep the spaces
                const segments = line.split(/(\s+)/);

                segments.forEach((segment, segIndex) => {
                    if (URL_REGEX.test(segment)) {
                        processedParts.push(
                            <a
                                key={`${lineIndex}-${segIndex}`}
                                href={segment.startsWith("http") ? segment : `https://${segment}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="chat-link"
                            >
                                {segment}
                            </a>
                        );
                    } else if (EMAIL_REGEX.test(segment)) {
                        processedParts.push(
                            <a
                                key={`${lineIndex}-${segIndex}`}
                                href={`mailto:${segment}`}
                                className="chat-link"
                            >
                                {segment}
                            </a>
                        );
                    } else if (PHONE_REGEX.test(segment) && segment.length >= 9) {
                        processedParts.push(
                            <a
                                key={`${lineIndex}-${segIndex}`}
                                href={`tel:${segment}`}
                                className="chat-link"
                            >
                                {segment}
                            </a>
                        );
                    } else {
                        processedParts.push(segment);
                    }
                });

                return (
                    <React.Fragment key={lineIndex}>
                        {processedParts}
                        {lineIndex < lines.length - 1 && <br />}
                    </React.Fragment>
                );
            })}
        </>
    );
}
