import { render } from '@react-email/render';
import React from 'react';
import { IdeationEmail, IdeationEmailProps } from './IdeationEmail';

/**
 * Render the Ideation Email template to HTML
 */
export async function renderIdeationEmailHtml(props: IdeationEmailProps): Promise<string> {
  return await render(React.createElement(IdeationEmail, props));
}

/**
 * Render the Ideation Email template to Plain Text
 */
export async function renderIdeationEmailText(props: IdeationEmailProps): Promise<string> {
  return await render(React.createElement(IdeationEmail, props), {
    plainText: true,
  });
}
